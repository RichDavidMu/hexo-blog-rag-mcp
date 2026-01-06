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

### Tool Description Configuration

自定义工具描述，引导 AI 助手在特定场景下调用工具：

| Variable                            | Description                   | Default                                                                                                                                              |
| ----------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TOOL_SEARCH_BLOG_DESCRIPTION`      | `search_blog` 工具的描述      | `在 Hexo 博客中搜索相关内容。该博客主要涵盖 JavaScript、前端开发、React 和大语言模型(LLM)相关技术内容。仅当用户询问这些主题相关的问题时使用此工具。` |
| `TOOL_GET_BLOG_CONTEXT_DESCRIPTION` | `get_blog_context` 工具的描述 | `获取博客内容用于回答问题。该博客专注于 JavaScript、前端开发、React 和 LLM 技术。仅在用户提问涉及这些技术领域时调用。`                               |

**使用场景示例**：

如果你的博客专注于特定领域（如前端、AI、区块链等），可以通过自定义工具描述来限制 AI 助手只在相关主题下调用搜索工具，避免在无关问题上浪费调用：

```bash
# 示例：限定为前端技术博客
TOOL_SEARCH_BLOG_DESCRIPTION="在前端技术博客中搜索内容。该博客涵盖 React、Vue、TypeScript、前端工程化等主题。仅在用户询问前端相关技术问题时使用。"

# 示例：限定为 AI/ML 博客
TOOL_SEARCH_BLOG_DESCRIPTION="在 AI 和机器学习博客中搜索。涵盖深度学习、LLM、提示工程、模型微调等内容。仅在 AI/ML 相关问题时调用。"

# 示例：通用博客（不限制）
TOOL_SEARCH_BLOG_DESCRIPTION="在博客中搜索相关内容。"
```

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
