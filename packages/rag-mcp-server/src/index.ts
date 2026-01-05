import express from 'express';
import { HexoRAGMCPServer } from './mcp-server.js';

const app = express();
app.use(express.json());
const mcpServer = new HexoRAGMCPServer();
await mcpServer.initialize();
await mcpServer.start();
app.get('/mcp', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  mcpServer.transport!.handleRequest(req, res);
});
app.post('/mcp', async (req, res) => {
  mcpServer.transport!.handleRequest(req, res);
});
app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
