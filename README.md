# hexo-blog-rag-mcp

A RAG MCP server for Hexo blog with vector search capabilities.

## Features

- 🔍 Vector-based semantic search for Hexo blog posts
- 🤖 Multiple embedding model support (Simple, OpenAI, Qwen)
- 📊 Incremental indexing based on file hash
- 👀 Real-time file watching for automatic updates
- 📝 JSON-based structured logging
- 🎯 Search threshold filtering

## Environment Variables

### Required

| Variable          | Description                             | Example              |
| ----------------- | --------------------------------------- | -------------------- |
| `HEXO_SOURCE_DIR` | Path to your Hexo blog source directory | `/path/to/hexo/blog` |
| `DB_DIR`          | LanceDB vector database directory       | `./data`             |
| `MCP_NAME`        | MCP server name                         | `hexo-blog-rag`      |

### Embedding Configuration

Choose one of the following embedding methods:

#### 1. Simple Embedding (Default)

No additional configuration needed. Uses a hash-based vectorization method.

```bash
EMBEDDING_TYPE=simple
```

#### 2. OpenAI Embedding

```bash
EMBEDDING_TYPE=openai
OPENAI_API_KEY=sk-xxxxxxxxxxxxx
OPENAI_EMBEDDING_MODEL=text-embedding-3-small  # Optional, default: text-embedding-3-small
OPENAI_BASE_URL=https://api.openai.com/v1      # Optional, for custom endpoints
```

**Supported models:**

- `text-embedding-3-small` (1536 dimensions)
- `text-embedding-3-large` (3072 dimensions)
- `text-embedding-ada-002` (1536 dimensions)

#### 3. Qwen Embedding

```bash
EMBEDDING_TYPE=qwen
QWEN_API_KEY=sk-xxxxxxxxxxxxx
QWEN_EMBEDDING_MODEL=text-embedding-v3         # Optional, default: text-embedding-v3
QWEN_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1  # Optional
```

**Supported models:**

- `text-embedding-v3` (1024 dimensions)
- `text-embedding-v2` (1536 dimensions)

### Optional

| Variable    | Description                              | Default       |
| ----------- | ---------------------------------------- | ------------- |
| `NODE_ENV`  | Environment mode                         | `development` |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info`        |

## Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm run build
```

## Usage

### Development

```bash
# Create .env file
cp .env.example .env

# Edit .env with your configuration
# Then start the server
pnpm run dev
```

### Production

```bash
# Build the project
pnpm run build

# Start the server
pnpm run start
```

### Docker

```bash
# Build image
docker build -t hexo-blog-rag-mcp .

# Run container
docker run -d \
  -p 3000:3000 \
  -e HEXO_SOURCE_DIR=/data/blog \
  -e EMBEDDING_TYPE=openai \
  -e OPENAI_API_KEY=sk-xxxxx \
  -v /path/to/hexo/blog:/data/blog \
  hexo-blog-rag-mcp
```

## MCP Tools

### `search_blog`

Search for relevant content in the Hexo blog.

**Parameters:**

- `query` (string, required): Search query
- `topK` (number, optional): Number of results to return (default: 5)
- `threshold` (number, optional): Similarity threshold (default: 1.0)

**Example:**

```json
{
  "query": "How to deploy Hexo",
  "topK": 3,
  "threshold": 0.8
}
```

### `get_blog_context`

Get blog content relevant to a question.

**Parameters:**

- `question` (string, required): User question
- `threshold` (number, optional): Similarity threshold (default: 1.0)

**Example:**

```json
{
  "question": "What is the best way to optimize Hexo blog performance?",
  "threshold": 0.7
}
```

## Logs

Logs are stored in the `logs/` directory:

- `app-YYYY-MM-DD.log` - Application logs
- `error-YYYY-MM-DD.log` - Error logs

Logs are rotated daily and kept for 14 days.

## License

Apache-2.0
