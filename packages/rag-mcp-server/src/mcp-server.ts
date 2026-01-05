import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { HexoLoader } from './loaders/hexo-loader.js';
import { TextSplitter } from './utils/splitter.js';
import { VectorStore } from './storage/vector-store.js';

export class HexoRAGMCPServer {
  private vectorStore: VectorStore;
  private loader: HexoLoader;
  private splitter: TextSplitter;
  private server: McpServer;
  transport: StreamableHTTPServerTransport | null = null;

  constructor(hexoBlogPath: string) {
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

    // 加载 Hexo 文档
    console.error('Loading Hexo documents...');
    const documents = await this.loader.loadAllDocuments();
    console.error(`Loaded ${documents.length} documents`);

    // 分割文本
    console.error('Splitting documents...');
    let totalChunks = 0;
    for (const doc of documents) {
      const chunks = this.splitter.split(doc.content, doc.id, doc.title);
      await this.vectorStore.addChunks(chunks);
      totalChunks += chunks.length;
    }
    console.error(`Created ${totalChunks} chunks`);
    this.registerTools();
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
        }),
      },
      async (input) => {
        const { query, topK = 5 } = input;
        const results = await this.vectorStore.search(query, topK);
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
        }),
      },
      async (input) => {
        const { question } = input;
        const results = await this.vectorStore.search(question, 3);
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
