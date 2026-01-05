export interface Chunk {
  text: string;
  docId: string;
  title: string;
  chunkIndex: number;
}

export class TextSplitter {
  private chunkSize: number;
  private overlap: number;

  constructor(chunkSize: number = 1000, overlap: number = 200) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  split(text: string, docId: string, title: string): Chunk[] {
    // 先按段落分割
    const paragraphs = text.split('\n\n').filter((p) => p.trim().length > 0);
    const chunks: Chunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      if ((currentChunk + paragraph).length > this.chunkSize && currentChunk.length > 0) {
        // 保存当前块
        chunks.push({
          text: currentChunk.trim(),
          docId,
          title,
          chunkIndex: chunkIndex++,
        });

        // 新块从上一个块的末尾开始（重叠）
        currentChunk = currentChunk.slice(-this.overlap) + '\n\n' + paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    // 保存最后一个块
    if (currentChunk.trim().length > 0) {
      chunks.push({
        text: currentChunk.trim(),
        docId,
        title,
        chunkIndex: chunkIndex,
      });
    }

    return chunks;
  }
}
