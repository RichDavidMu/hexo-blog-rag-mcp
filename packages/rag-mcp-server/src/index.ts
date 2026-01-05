import type { Request, Response } from 'express';
import express from 'express';
import { HexoRAGMCPServer } from './mcp-server.js';
import logger from './utils/logger.js';

const app = express();
app.use(express.json());

const mcpServer = new HexoRAGMCPServer();
const setupServer = async () => {
  await mcpServer.initialize();
  await mcpServer.start();
  return mcpServer;
};

app.get('/mcp', async (_req: Request, res: Response) => {
  logger.info('Received GET MCP request');
  res.status(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    }),
  );
});

app.delete('/mcp', async (_req: Request, res: Response) => {
  logger.info('Received DELETE MCP request');
  res.status(405).end(
    JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed.',
      },
      id: null,
    }),
  );
});
app.post('/mcp', async (req, res) => {
  console.log('Received MCP request:', req.body);
  try {
    await mcpServer.transport!.handleRequest(req, res);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});
setupServer().then(() => {
  app.listen(3000, () => {
    console.log('✅ Server running on http://localhost:3000');
  });
});
