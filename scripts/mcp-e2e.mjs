// 完整 MCP 端到端测试：建立 SSE → initialize → tools/call browser_navigate
// 通过 stdio 直接调，不走 SSE（更可靠）

import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const child = spawn('node', ['src/main/mcp/server.mjs'], {
  cwd: '/opt/kore-fingerprint',
  env: { ...process.env, KORE_MCP_MODE: 'stdio' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let responseData = '';
child.stdout.on('data', (chunk) => {
  responseData += chunk.toString();
  console.log('   [server stdout]', chunk.toString().slice(0, 300));
});
child.stderr.on('data', (chunk) => {
  console.log('   [server log]', chunk.toString().trim());
});

console.log('1. 等待 server 启动...');
await sleep(2000);
console.log('   ✅ 假设 server ready');
console.log();

console.log('2. 发送 initialize 请求...');
const initReq = JSON.stringify({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'kore-fingerprint-e2e', version: '1.0.0' }
  }
});
child.stdin.write(initReq + '\n');
await sleep(2000);
console.log();

console.log('3. 发送 tools/list 请求...');
const listReq = JSON.stringify({
  jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}
});
child.stdin.write(listReq + '\n');
await sleep(1000);
console.log();

console.log('4. 发送 tools/call browser_get_fingerprint...');
const callReq = JSON.stringify({
  jsonrpc: '2.0', id: 3, method: 'tools/call',
  params: { name: 'browser_get_fingerprint', arguments: { profileId: 'test-e2e' } }
});
child.stdin.write(callReq + '\n');
console.log('   （这会启动 Chromium，约 5-10 秒）');
await sleep(15000);
console.log();

console.log('5. 完整响应:');
console.log(responseData.slice(0, 2000));
console.log();

child.kill();
process.exit(0);
