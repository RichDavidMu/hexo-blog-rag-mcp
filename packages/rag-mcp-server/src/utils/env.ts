export const HEXO_SOURCE_DIR = process.env.HEXO_SOURCE_DIR || '/app/source';
export const MCP_NAME = process.env.MCP_NAME || 'HexoRAGMCPServer';
export const DB_DIR = process.env.DB_DIR || '/app/db';

// 工具描述配置
export const TOOL_SEARCH_BLOG_DESCRIPTION =
  process.env.TOOL_SEARCH_BLOG_DESCRIPTION ||
  '在 Hexo 博客中搜索相关内容。该博客主要涵盖 JavaScript、前端开发、React 和大语言模型(LLM)相关技术内容。仅当用户询问这些主题相关的问题时使用此工具。';

export const TOOL_GET_BLOG_CONTEXT_DESCRIPTION =
  process.env.TOOL_GET_BLOG_CONTEXT_DESCRIPTION ||
  '获取博客内容用于回答问题。该博客专注于 JavaScript、前端开发、React 和 LLM 技术。仅在用户提问涉及这些技术领域时调用。';
