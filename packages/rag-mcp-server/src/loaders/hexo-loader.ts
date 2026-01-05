import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'fs-extra';
import matter from 'gray-matter';

export interface Document {
  id: string;
  title: string;
  content: string;
  metadata: {
    date?: Date;
    tags?: string[];
    categories?: string[];
  };
}

export interface DocumentInfo {
  id: string;
  filename: string;
  hash: string;
}

export class HexoLoader {
  private readonly postsDir: string;

  constructor(hexoBlogPath: string) {
    this.postsDir = path.join(hexoBlogPath, 'source', '_posts');
  }

  async calculateFileHash(filePath: string): Promise<string> {
    const content = await fs.readFile(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  async getAllDocumentInfo(): Promise<DocumentInfo[]> {
    const files = await fs.readdir(this.postsDir);
    const docInfos: DocumentInfo[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const filePath = path.join(this.postsDir, file);
          const hash = await this.calculateFileHash(filePath);
          docInfos.push({
            id: file.replace('.md', ''),
            filename: file,
            hash,
          });
        } catch (error) {
          console.error(`Error getting info for ${file}:`, error);
        }
      }
    }
    return docInfos;
  }

  async loadDocument(docId: string): Promise<Document> {
    const filename = `${docId}.md`;
    return this.loadDocumentByFilename(filename);
  }

  private async loadDocumentByFilename(filename: string): Promise<Document> {
    const filePath = path.join(this.postsDir, filename);
    const content = await fs.readFile(filePath, 'utf-8');

    // 使用 gray-matter 解析 Front Matter
    const { data, content: body } = matter(content);

    return {
      id: filename.replace('.md', ''),
      title: data.title || filename,
      content: body.trim(),
      metadata: {
        date: data.date,
        tags: data.tags || [],
        categories: data.categories || [],
      },
    };
  }
}
