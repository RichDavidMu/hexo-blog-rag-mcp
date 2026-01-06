import type { Connection, Table } from '@lancedb/lancedb';
import lancedb from '@lancedb/lancedb';
import type { Chunk } from '../utils/splitter.js';
import logger from '../utils/logger.js';
import { DB_DIR } from '../utils/env.js';
import { type EmbeddingService, createEmbeddingService } from '../services/embedding.js';

export class VectorStore {
  private db: Connection | null = null;
  private table: Table | null = null;
  private embeddingService: EmbeddingService;

  constructor() {
    this.embeddingService = createEmbeddingService();
  }

  async initialize() {
    this.db = await lancedb.connect(DB_DIR);
    try {
      this.table = await this.db.openTable('documents');
    } catch (_) {
      this.table = null;
    }
    logger.info('Vector database initialized');
    logger.info(`Embedding dimension: ${this.embeddingService.getDimension()}`);
  }

  async addChunks(chunks: Chunk[], hash: string): Promise<void> {
    if (!this.db) {
      throw new Error('Vector store not initialized');
    }

    // 并行生成所有 chunk 的向量
    const data = await Promise.all(
      chunks.map(async (chunk) => ({
        id: `${chunk.docId}_${chunk.chunkIndex}`,
        text: chunk.text,
        vector: await this.embeddingService.embed(chunk.text),
        docId: chunk.docId,
        title: chunk.title,
        chunkIndex: chunk.chunkIndex,
        hash,
      })),
    );

    if (!this.table) {
      this.table = await this.db.createTable('documents', data);
    } else {
      await this.table.add(data);
    }

    logger.info(`Added ${data.length} chunks to vector store`);
  }

  async search(query: string, topK: number = 5, threshold: number = 1.0): Promise<Chunk[]> {
    if (!this.table) {
      throw new Error('Vector store not initialized');
    }

    const queryVector = await this.embeddingService.embed(query);
    const results: ({ _distance: number } & Chunk)[] = await this.table
      .search(queryVector)
      .limit(topK)
      .toArray();

    // 过滤掉距离大于阈值的结果（距离越小越相似）
    const filteredResults = results.filter((result) => {
      const distance = result._distance ?? Infinity;
      return distance <= threshold;
    });

    return filteredResults.map((result) => ({
      text: result.text,
      docId: result.docId,
      title: result.title,
      chunkIndex: result.chunkIndex,
    }));
  }

  async getDocumentHashes(): Promise<Map<string, string>> {
    if (!this.table) {
      return new Map();
    }

    try {
      const results = await this.table.query().select(['title', 'hash']).toArray();
      const hashMap = new Map<string, string>();
      for (const result of results) {
        if (!hashMap.has(result.title)) {
          hashMap.set(result.title, result.hash);
        }
      }
      return hashMap;
    } catch (_) {
      return new Map();
    }
  }

  async deleteDocument(docId: string): Promise<void> {
    if (!this.table) {
      throw new Error('Vector store not initialized');
    }

    await this.table.delete(`docId = "${docId}"`);
    logger.info(`Deleted document: ${docId}`);
  }

  async deleteDocumentByTitle(title: string): Promise<void> {
    if (!this.table) {
      throw new Error('Vector store not initialized');
    }

    await this.table.delete(`title = "${title}"`);
    logger.info(`Deleted document by title: ${title}`);
  }
}
