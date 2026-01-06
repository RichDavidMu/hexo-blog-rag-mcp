import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import chokidar from 'chokidar';
import { HexoLoader } from './loaders/hexo-loader.js';
import { TextSplitter } from './utils/splitter.js';
import { VectorStore } from './storage/vector-store.js';
import logger from './utils/logger.js';
import {
  HEXO_SOURCE_DIR,
  MCP_NAME,
  TOOL_GET_BLOG_CONTEXT_DESCRIPTION,
  TOOL_SEARCH_BLOG_DESCRIPTION,
} from './utils/env.js';

export class HexoRAGMCPServer {
  private vectorStore: VectorStore;
  private loader: HexoLoader;
  private splitter: TextSplitter;
  private server: McpServer;
  private readonly hexoBlogPath = HEXO_SOURCE_DIR;
  transport: StreamableHTTPServerTransport | null = null;

  constructor() {
    this.vectorStore = new VectorStore();
    this.loader = new HexoLoader();
    this.splitter = new TextSplitter(1000, 200);
    this.server = new McpServer({
      name: MCP_NAME,
      version: '1.0.0',
    });
  }

  async start() {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await this.server.connect(transport);
    this.transport = transport;
    logger.info('Hexo RAG MCP Server running');
  }

  async initialize(): Promise<void> {
    logger.info('Initializing RAG MCP Server...');

    // 初始化向量存储
    await this.vectorStore.initialize();

    // 执行增量更新
    await this.updateIndex();

    // 启动文件监听
    this.startFileWatcher();

    this.registerTools();
  }

  private startFileWatcher(): void {
    const postsDir = this.hexoBlogPath;
    logger.info(`Starting file watcher on: ${postsDir}`);

    const watcher = chokidar.watch(postsDir, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher
      .on('add', (filePath) => {
        logger.info(`File added: ${filePath}`);
        this.handleFileChange(filePath).catch((err) => {
          logger.error(`Error handling file add`, { error: err });
        });
      })
      .on('change', (filePath) => {
        logger.info(`File changed: ${filePath}`);
        this.handleFileChange(filePath).catch((err) => {
          logger.error(`Error handling file change`, { error: err });
        });
      })
      .on('unlink', (filePath) => {
        logger.info(`File deleted: ${filePath}`);
        this.handleFileDelete(filePath).catch((err) => {
          logger.error(`Error handling file delete`, { error: err });
        });
      });

    logger.info('File watcher started');
  }

  private async handleFileChange(filePath: string): Promise<void> {
    const filename = path.basename(filePath);
    const docId = filename.replace('.md', '');

    // 加载文档
    const doc = await this.loader.loadDocument(docId);

    // 计算新哈希
    const hash = await this.loader.calculateFileHash(filePath);

    // 获取数据库中的哈希
    const dbHashes = await this.vectorStore.getDocumentHashes();
    const existingHash = dbHashes.get(doc.title);

    if (existingHash === hash) {
      logger.info(`File unchanged, skipping: ${doc.title}`);
      return;
    }

    // 删除旧数据（如果存在）
    if (existingHash) {
      logger.info(`Updating document: ${doc.title}`);
      await this.vectorStore.deleteDocumentByTitle(doc.title);
    } else {
      logger.info(`Adding new document: ${doc.title}`);
    }

    // 分割并添加文档
    const chunks = this.splitter.split(doc.content, doc.id, doc.title);
    await this.vectorStore.addChunks(chunks, hash);
    logger.info(`Document indexed: ${doc.title}`);
  }

  private async handleFileDelete(filename: string): Promise<void> {
    const docId = filename.replace('.md', '');

    // 尝试从数据库中找到并删除这个文档
    // 由于我们不知道文档的 title，需要通过 docId 来删除
    await this.vectorStore.deleteDocument(docId);
    logger.info(`Document deleted: ${docId}`);
  }

  private async updateIndex(): Promise<void> {
    logger.info('Updating index...');

    // 获取数据库中已有的文档哈希值（title -> hash）
    const dbHashes = await this.vectorStore.getDocumentHashes();
    logger.info(`Found ${dbHashes.size} documents in database`);

    // 获取文件系统中所有文档的信息
    const docInfos = await this.loader.getAllDocumentInfo();
    logger.info(`Found ${docInfos.length} documents in filesystem`);

    const currentTitles = new Set<string>();
    let added = 0;
    let updated = 0;
    let skipped = 0;

    // 处理每个文档
    for (const docInfo of docInfos) {
      // 先加载文档获取 title
      const doc = await this.loader.loadDocument(docInfo.id);
      currentTitles.add(doc.title);

      const existingHash = dbHashes.get(doc.title);

      if (existingHash === docInfo.hash) {
        // 哈希值相同，跳过
        logger.info(`Skipping unchanged document: ${doc.title}`);
        skipped++;
        continue;
      }

      if (existingHash) {
        // 文档存在但哈希值不同，删除旧数据
        logger.info(`Updating document: ${doc.title}`);
        await this.vectorStore.deleteDocumentByTitle(doc.title);
        updated++;
      } else {
        // 新文档
        logger.info(`Adding new document: ${doc.title}`);
        added++;
      }

      // 分割并添加文档
      const chunks = this.splitter.split(doc.content, doc.id, doc.title);
      await this.vectorStore.addChunks(chunks, docInfo.hash);
    }

    // 删除不再存在的文档
    let deleted = 0;
    for (const [title] of dbHashes) {
      if (!currentTitles.has(title)) {
        logger.info(`Deleting removed document: ${title}`);
        await this.vectorStore.deleteDocumentByTitle(title);
        deleted++;
      }
    }

    logger.info(
      `Index update complete: ${added} added, ${updated} updated, ${skipped} skipped, ${deleted} deleted`,
    );
  }

  registerTools(): void {
    logger.info('Registering tools...');
    this.server.registerTool(
      'search_blog',
      {
        description: TOOL_SEARCH_BLOG_DESCRIPTION,
        inputSchema: z.object({
          query: z.string().describe('搜索查询'),
          topK: z.number().optional().default(5).describe('返回的最相关结果数量，默认为 5'),
          threshold: z
            .number()
            .optional()
            .default(1.0)
            .describe('相似度阈值，默认为 1.0，只返回距离小于此值的结果'),
        }),
      },
      async (input) => {
        const { query, topK = 5, threshold = 1.0 } = input;
        const results = await this.vectorStore.search(query, topK, threshold);
        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: '未找到相关内容' }],
          };
        }
        const formattedResults = results.map((r) =>
          [`Title: ${r.title}:`, `DocId: ${r.docId}`, `Content: ${r.text}`, '---'].join('\n'),
        );
        const searchResultText = `Search Results for "${query}":\n\n${formattedResults.join('\n')}`;
        return {
          content: [{ type: 'text', text: searchResultText }],
        };
      },
    );
    this.server.registerTool(
      'get_blog_context',
      {
        description: TOOL_GET_BLOG_CONTEXT_DESCRIPTION,
        inputSchema: z.object({
          question: z.string().describe('用户的问题'),
          threshold: z
            .number()
            .optional()
            .default(1.0)
            .describe('相似度阈值，默认为 1.0，只返回距离小于此值的结果'),
        }),
      },
      async (input) => {
        const { question, threshold = 1.0 } = input;
        const results = await this.vectorStore.search(question, 3, threshold);
        if (results.length === 0) {
          return {
            content: [{ type: 'text', text: '未找到相关内容' }],
          };
        }
        const context = results
          .map((r) => `Title:${r.title}\nContent:${r.text}`)
          .join('\n\n---\n\n');
        return {
          content: [{ type: 'text', text: context }],
        };
      },
    );
  }
}
