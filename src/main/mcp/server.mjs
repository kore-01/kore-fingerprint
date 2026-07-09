// kore-fingerprint MCP Server (主入口)

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Logger } from '../utils/logger.mjs';
import { registerBrowserTools } from "./tools/browser.mjs";
import { registerOCRTools } from "./tools/ocr.mjs";
import { startStdioTransport } from './transport/stdio.mjs';
import { startSSETransport } from './transport/sse.mjs';

const logger = new Logger('mcp:server');

export function createMCPServer() {
  const server = new McpServer({
    name: 'kore-fingerprint',
    version: '0.1.0',
    description: 'A MCP-controllable anti-detect browser for AI multi-account automation',
    author: 'kore-01',
    homepage: 'https://github.com/kore-01/kore-fingerprint'
  });

  registerBrowserTools(server);
  registerOCRTools(server);
  logger.info('MCP Server instance created');
  return server;
}

export async function startStdio() {
  const server = createMCPServer();
  await startStdioTransport(server);
  return server;
}

export async function startSSE(options = {}) {
  const server = createMCPServer();
  const result = await startSSETransport(server, options);
  return Object.assign({ server }, result);
}

export async function startDual() {
  logger.info('Starting MCP Server in DUAL mode (stdio + SSE)');
  const server = createMCPServer();

  const sseResult = await startSSETransport(server);
  logger.info('SSE transport ready');

  if (process.env.KORE_MCP_STDIO !== 'disabled') {
    try {
      await startStdioTransport(server);
      logger.info('Stdio transport ready');
    } catch (e) {
      logger.warn('Stdio failed (normal in Electron): ' + e.message);
    }
  }

  return Object.assign({ server }, sseResult);
}

const isMainModule = import.meta.url === 'file://' + process.argv[1];
if (isMainModule) {
  const mode = process.env.KORE_MCP_MODE || 'sse';
  const port = parseInt(process.env.KORE_MCP_PORT || '39391');

  logger.info('Starting kore-fingerprint MCP Server v0.1.0 (mode=' + mode + ')');

  (async () => {
    try {
      if (mode === 'stdio') {
        await startStdio();
      } else if (mode === 'sse') {
        await startSSE({ port });
      } else if (mode === 'dual') {
        await startDual();
      } else {
        logger.error('Unknown mode: ' + mode + '. Use stdio|sse|dual');
        process.exit(1);
      }

      logger.info('MCP Server running. Press Ctrl+C to stop.');

      process.on('SIGINT', () => {
        logger.info('Shutting down...');
        process.exit(0);
      });
      process.on('SIGTERM', () => {
        logger.info('Shutting down...');
        process.exit(0);
      });
    } catch (error) {
      logger.error('Failed to start: ' + error.message);
      process.exit(1);
    }
  })();
}
