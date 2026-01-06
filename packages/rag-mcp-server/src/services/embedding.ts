import OpenAI from 'openai';
import logger from '../utils/logger.js';

/**
 * Embedding 服务接口
 */
export interface EmbeddingService {
  /**
   * 将文本转换为向量
   * @param text 输入文本
   * @returns 向量数组
   */
  embed(text: string): Promise<number[]>;

  /**
   * 获取向量维度
   */
  getDimension(): number;
}

/**
 * Simple Embedding - 简单哈希方法（默认）
 */
export class SimpleEmbedding implements EmbeddingService {
  private readonly dimension = 384;

  getDimension(): number {
    return this.dimension;
  }

  async embed(text: string): Promise<number[]> {
    const words = text.toLowerCase().split(/\s+/);
    const vector = new Array(this.dimension).fill(0);

    for (const word of words) {
      let hash = 0;
      for (let i = 0; i < word.length; i++) {
        hash = (hash << 5) - hash + word.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
      }
      vector[Math.abs(hash) % this.dimension] += 1;
    }

    // 归一化
    const norm = Math.sqrt(vector.reduce((a, b) => a + b * b, 0));
    return norm > 0 ? vector.map((v) => v / norm) : vector;
  }
}

/**
 * OpenAI Embedding
 */
export class OpenAIEmbedding implements EmbeddingService {
  private client: OpenAI;
  private model: string;
  private dimension: number;

  constructor(apiKey: string, model = 'text-embedding-3-small', baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.model = model;
    // text-embedding-3-small: 1536 dimensions
    // text-embedding-3-large: 3072 dimensions
    // text-embedding-ada-002: 1536 dimensions
    this.dimension = model.includes('large') ? 3072 : 1536;
    logger.info(`Initialized OpenAI Embedding with model: ${model}`);
  }

  getDimension(): number {
    return this.dimension;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('OpenAI embedding failed', { error });
      throw error;
    }
  }
}

/**
 * Qwen Embedding (通过 OpenAI 兼容接口)
 */
export class QwenEmbedding implements EmbeddingService {
  private client: OpenAI;
  private model: string;
  private dimension: number;

  constructor(apiKey: string, model = 'text-embedding-v3', baseURL?: string) {
    // Qwen 使用 OpenAI 兼容的 API
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    });
    this.model = model;
    // text-embedding-v3: 1024 dimensions
    // text-embedding-v2: 1536 dimensions
    this.dimension = model.includes('v3') ? 1024 : 1536;
    logger.info(`Initialized Qwen Embedding with model: ${model}`);
  }

  getDimension(): number {
    return this.dimension;
  }

  async embed(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: this.model,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Qwen embedding failed', { error });
      throw error;
    }
  }
}

/**
 * 根据配置创建 Embedding 服务
 */
export function createEmbeddingService(): EmbeddingService {
  const embeddingType = process.env.EMBEDDING_TYPE || 'simple';

  switch (embeddingType.toLowerCase()) {
    case 'openai': {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('OPENAI_API_KEY is required for OpenAI embedding');
      }
      return new OpenAIEmbedding(
        apiKey,
        process.env.OPENAI_EMBEDDING_MODEL,
        process.env.OPENAI_BASE_URL,
      );
    }

    case 'qwen': {
      const apiKey = process.env.QWEN_API_KEY;
      if (!apiKey) {
        throw new Error('QWEN_API_KEY is required for Qwen embedding');
      }
      return new QwenEmbedding(apiKey, process.env.QWEN_EMBEDDING_MODEL, process.env.QWEN_BASE_URL);
    }

    case 'simple':
    default:
      logger.info('Using Simple Embedding (hash-based)');
      return new SimpleEmbedding();
  }
}
