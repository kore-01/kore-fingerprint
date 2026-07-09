// MCP Stdio Transport
// 用于 Claude Desktop 本地连接

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Logger } from '../../utils/logger.mjs';

const logger = new Logger('mcp:stdio');

export async function startStdioTransport(server) {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info('Stdio transport started - waiting for Claude Desktop connection');
  return transport;
}
