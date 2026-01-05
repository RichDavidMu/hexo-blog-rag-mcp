import express from 'express';
import { HexoRAGMCPServer } from './mcp-server.js';

const app = express();
app.use(express.json());
const mcpServer = new HexoRAGMCPServer(process.env.HEXO_SOURCE_DIR!);
await mcpServer.initialize();
await mcpServer.start();
app.post('/mcp', async (req, res) => {
  mcpServer.transport!.handleRequest(req, res);
});
app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
