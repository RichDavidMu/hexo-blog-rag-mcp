import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Connection, Table } from '@lancedb/lancedb';
import lancedb from '@lancedb/lancedb';
import type { Chunk } from '../utils/splitter.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function simpleVectorize(text: string): number[] {
  // 这里演示简单的哈希方法，实际应用建议使用专业的embedding模型
  const words = text.toLowerCase().split(/\s+/);
  const vector = new Array(384).fill(0);

  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    vector[Math.abs(hash) % 384] += 1;
  }

  // 归一化
  const norm = Math.sqrt(vector.reduce((a, b) => a + b * b, 0));
  return norm > 0 ? vector.map((v) => v / norm) : vector;
}

export class VectorStore {
  private db: Connection | null = null;
  private table: Table | null = null;

  async initialize() {
    this.db = await lancedb.connect(process.env.DB_DIR!);
    try {
      this.table = await this.db.openTable('documents');
    } catch (_) {
      this.table = null;
    }
    logger.info('Vector database initialized');
  }

  async addChunks(chunks: Chunk[], hash: string): Promise<void> {
    const data = chunks.map((chunk) => ({
      id: `${chunk.docId}_${chunk.chunkIndex}`,
      text: chunk.text,
      vector: simpleVectorize(chunk.text),
      docId: chunk.docId,
      title: chunk.title,
      chunkIndex: chunk.chunkIndex,
      hash,
    }));
    if (!this.db) {
      throw new Error('Vector store not initialized');
    }

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

    const queryVector = simpleVectorize(query);
    const results = await this.table.search(queryVector).limit(topK).toArray();

    // 过滤掉距离大于阈值的结果（距离越小越相似）
    const filteredResults = results.filter((result: any) => {
      const distance = result._distance ?? Infinity;
      return distance <= threshold;
    });

    return filteredResults.map((result: any) => ({
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
