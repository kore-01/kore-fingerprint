// 完整 MCP E2E: tools/call browser_solve_captcha with real captcha image
import { spawn } from 'child_process';
import { readFileSync } from 'fs';

const child = spawn('node', ['src/main/mcp/server.mjs'], {
  cwd: '/opt/kore-fingerprint',
  env: { ...process.env, KORE_MCP_MODE: 'stdio' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let logs = '';
let responses = '';
child.stdout.on('data', (chunk) => {
  const s = chunk.toString();
  responses += s;
  // 尝试解析 JSON-RPC 响应
  const lines = s.split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.id) {
        console.log(`\n📨 Response id=${obj.id}:`);
        if (obj.result?.content?.[0]?.text) {
          const text = obj.result.content[0].text;
          try {
            const parsed = JSON.parse(text);
            console.log(JSON.stringify(parsed, null, 2));
          } catch {
            console.log(text.slice(0, 500));
          }
        } else if (obj.error) {
          console.log('❌ Error:', JSON.stringify(obj.error));
        }
      }
    } catch {}
  }
});
child.stderr.on('data', (chunk) => {
  logs += chunk.toString();
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  // 读真实验证码图片 → base64
  const img = readFileSync('/tmp/test_captcha2.png');
  const b64 = img.toString('base64');
  console.log('=== Day 4.1 OCR E2E 测试 ===\n');
  console.log('验证码图片大小:', img.length, 'bytes');
  console.log('Base64 长度:', b64.length);
  console.log('预期文字: A7K9\n');

  await sleep(1500);
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ocr-test', version: '1.0' }
  }});
  await sleep(1000);
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  await sleep(500);
  
  console.log('\n--- 测试 1: tesseract 模式 ---');
  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: {
    name: 'browser_solve_captcha', arguments: { imageBase64: b64, mode: 'ocr' }
  }});
  await sleep(5000);
  
  child.kill();
  process.exit(0);
})();
