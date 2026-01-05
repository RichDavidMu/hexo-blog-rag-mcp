import path from 'node:path';
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

export class HexoLoader {
  private readonly postsDir: string;

  constructor(hexoBlogPath: string) {
    this.postsDir = path.join(hexoBlogPath, 'source', '_posts');
  }

  async loadAllDocuments(): Promise<Document[]> {
    const files = await fs.readdir(this.postsDir);
    const documents: Document[] = [];

    for (const file of files) {
      if (file.endsWith('.md')) {
        try {
          const document = await this.loadDocument(file);
          documents.push(document);
        } catch (error) {
          console.error(`Error loading ${file}:`, error);
        }
      }
    }
    return documents;
  }

  private async loadDocument(filename: string): Promise<Document> {
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
