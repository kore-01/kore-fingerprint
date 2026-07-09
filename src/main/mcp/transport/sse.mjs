// MCP SSE Transport (Server-Sent Events)
// 用于远程 MCP 客户端连接
// 默认端口 39391（避开 39390 LLM Wiki）

import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import express from 'express';
import { Logger } from '../../utils/logger.mjs';

const logger = new Logger('mcp:sse');

export async function startSSETransport(server, options = {}) {
  const port = options.port || 39391;
  const host = options.host || '0.0.0.0';

  const app = express();
  app.use(express.json());

  const sessions = new Map();

  app.get('/sse', async (req, res) => {
    const sessionId = 'sess-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    logger.info('New SSE connection: ' + sessionId);

    const transport = new SSEServerTransport('/messages', res);
    sessions.set(sessionId, transport);

    transport.onclose = () => {
      logger.info('SSE session closed: ' + sessionId);
      sessions.delete(sessionId);
    };

    await server.connect(transport);
  });

  app.post('/messages', async (req, res) => {
    const lastTransport = Array.from(sessions.values()).pop();
    if (!lastTransport) {
      res.status(400).json({ error: 'No active SSE session' });
      return;
    }
    await lastTransport.handlePostMessage(req, res, req.body);
  });

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      transport: 'sse',
      sessions: sessions.size,
      uptime: process.uptime()
    });
  });

  app.get('/', (req, res) => {
    res.json({
      name: 'kore-fingerprint MCP Server',
      version: '0.1.0',
      transport: 'SSE',
      endpoint: '/sse',
      health: '/health',
      tools: ['browser_navigate','browser_screenshot','browser_click','browser_type','browser_extract','browser_get_fingerprint','browser_solve_captcha']
    });
  });

  return new Promise((resolve, reject) => {
    const httpServer = app.listen(port, host, () => {
      logger.info('SSE transport listening on http://' + host + ':' + port);
      logger.info('  Health: http://' + host + ':' + port + '/health');
      logger.info('  SSE:    http://' + host + ':' + port + '/sse');
      resolve({ app, httpServer, sessions });
    });

    httpServer.on('error', reject);
  });
}
