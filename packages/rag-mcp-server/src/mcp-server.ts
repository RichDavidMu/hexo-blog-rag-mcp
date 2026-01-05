import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import chokidar from 'chokidar';
import { HexoLoader } from './loaders/hexo-loader.js';
import { TextSplitter } from './utils/splitter.js';
import { VectorStore } from './storage/vector-store.js';

export class HexoRAGMCPServer {
  private vectorStore: VectorStore;
  private loader: HexoLoader;
  private splitter: TextSplitter;
  private server: McpServer;
  private hexoBlogPath: string;
  transport: StreamableHTTPServerTransport | null = null;

  constructor(hexoBlogPath: string) {
    this.hexoBlogPath = hexoBlogPath;
    this.vectorStore = new VectorStore();
    this.loader = new HexoLoader(hexoBlogPath);
    this.splitter = new TextSplitter(1000, 200);
    this.server = new McpServer({
      name: process.env.MCP_NAME!,
      version: '1.0.0',
    });
  }

  async start() {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await this.server.connect(transport);
    this.transport = transport;
    console.error('Hexo RAG MCP Server running on stdio');
  }

  async initialize(): Promise<void> {
    console.error('Initializing RAG MCP Server...');

    // 初始化向量存储
    await this.vectorStore.initialize();

    // 执行增量更新
    await this.updateIndex();

    // 启动文件监听
    this.startFileWatcher();

    this.registerTools();
  }

  private startFileWatcher(): void {
    const postsDir = path.join(this.hexoBlogPath, 'source', '_posts');
    console.error(`Starting file watcher on: ${postsDir}`);

    const watcher = chokidar.watch(postsDir, {
      persistent: true,
      ignoreInitial: true,
    });

    watcher
      .on('add', (filePath) => {
        console.error(`File added: ${filePath}`);
        this.handleFileChange(filePath).catch((err) => {
          console.error(`Error handling file add: ${err}`);
        });
      })
      .on('change', (filePath) => {
        console.error(`File changed: ${filePath}`);
        this.handleFileChange(filePath).catch((err) => {
          console.error(`Error handling file change: ${err}`);
        });
      })
      .on('unlink', (filePath) => {
        console.error(`File deleted: ${filePath}`);
        this.handleFileDelete(filePath).catch((err) => {
          console.error(`Error handling file delete: ${err}`);
        });
      });

    console.error('File watcher started');
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
      console.error(`File unchanged, skipping: ${doc.title}`);
      return;
    }

    // 删除旧数据（如果存在）
    if (existingHash) {
      console.error(`Updating document: ${doc.title}`);
      await this.vectorStore.deleteDocumentByTitle(doc.title);
    } else {
      console.error(`Adding new document: ${doc.title}`);
    }

    // 分割并添加文档
    const chunks = this.splitter.split(doc.content, doc.id, doc.title);
    await this.vectorStore.addChunks(chunks, hash);
    console.error(`Document indexed: ${doc.title}`);
  }

  private async handleFileDelete(filename: string): Promise<void> {
    const docId = filename.replace('.md', '');

    // 尝试从数据库中找到并删除这个文档
    // 由于我们不知道文档的 title，需要通过 docId 来删除
    await this.vectorStore.deleteDocument(docId);
    console.error(`Document deleted: ${docId}`);
  }

  private async updateIndex(): Promise<void> {
    console.error('Updating index...');

    // 获取数据库中已有的文档哈希值（title -> hash）
    const dbHashes = await this.vectorStore.getDocumentHashes();
    console.error(`Found ${dbHashes.size} documents in database`);

    // 获取文件系统中所有文档的信息
    const docInfos = await this.loader.getAllDocumentInfo();
    console.error(`Found ${docInfos.length} documents in filesystem`);

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
        console.error(`Skipping unchanged document: ${doc.title}`);
        skipped++;
        continue;
      }

      if (existingHash) {
        // 文档存在但哈希值不同，删除旧数据
        console.error(`Updating document: ${doc.title}`);
        await this.vectorStore.deleteDocumentByTitle(doc.title);
        updated++;
      } else {
        // 新文档
        console.error(`Adding new document: ${doc.title}`);
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
        console.error(`Deleting removed document: ${title}`);
        await this.vectorStore.deleteDocumentByTitle(title);
        deleted++;
      }
    }

    console.error(
      `Index update complete: ${added} added, ${updated} updated, ${skipped} skipped, ${deleted} deleted`,
    );
  }

  registerTools(): void {
    console.error('Registering tools...');
    this.server.registerTool(
      'search_blog',
      {
        description: '在 Hexo 博客中搜索相关内容',
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
        description: '获取博客内容用于回答问题',
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
