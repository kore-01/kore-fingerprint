// 简化测试：仅 navigate + extract + screenshot
import { spawn } from 'child_process';

const child = spawn('node', ['src/main/mcp/server.mjs'], {
  cwd: '/opt/kore-fingerprint',
  env: { ...process.env, KORE_MCP_MODE: 'stdio' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let logs = [];
let responses = [];
child.stdout.on('data', (chunk) => {
  const s = chunk.toString();
  for (const line of s.split('\n').filter(l => l.trim())) {
    try {
      const obj = JSON.parse(line);
      if (obj.id) {
        const content = obj.result?.content?.[0]?.text;
        if (content) {
          try {
            responses.push({ id: obj.id, data: JSON.parse(content) });
          } catch {
            responses.push({ id: obj.id, data: content.slice(0, 300) });
          }
        }
      }
    } catch {}
  }
});
child.stderr.on('data', (chunk) => {
  for (const line of chunk.toString().split('\n').filter(l => l.includes('INFO') || l.includes('ERROR') || l.includes('WARN'))) {
    logs.push(line.trim());
  }
});

const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let curId = 0;

(async () => {
  console.log('=== Day 4.2 简化流程测试 ===\n');
  
  await sleep(1500);
  curId++;
  send({ jsonrpc: '2.0', id: curId, method: 'initialize', params: {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'simple-flow', version: '1.0' }
  }});
  await sleep(800);
  curId++;
  send({ jsonrpc: '2.0', id: curId, method: 'tools/list', params: {} });
  await sleep(500);
  
  console.log('Step 1: 启动 Chromium (via get_fingerprint)...');
  const t1 = Date.now();
  curId++;
  send({ jsonrpc: '2.0', id: curId, method: 'tools/call', params: {
    name: 'browser_get_fingerprint', arguments: { profileId: 'flow-simple' }
  }});
  await sleep(4000);
  
  console.log('Step 2: 导航 example.com...');
  const t2 = Date.now();
  curId++;
  send({ jsonrpc: '2.0', id: curId, method: 'tools/call', params: {
    name: 'browser_navigate', arguments: { url: 'https://example.com/', profileId: 'flow-simple' }
  }});
  await sleep(8000);  // 给导航充足时间
  
  console.log('Step 3: 提取页面文本...');
  curId++;
  send({ jsonrpc: '2.0', id: curId, method: 'tools/call', params: {
    name: 'browser_extract', arguments: { profileId: 'flow-simple', format: 'text' }
  }});
  await sleep(2000);
  
  console.log('Step 4: 截图...');
  curId++;
  send({ jsonrpc: '2.0', id: curId, method: 'tools/call', params: {
    name: 'browser_screenshot', arguments: { profileId: 'flow-simple', fullPage: false }
  }});
  await sleep(3000);
  
  console.log('\n=== 工具日志 ===');
  logs.forEach(l => console.log(' ', l));
  console.log('\n=== 响应数据 ===');
  responses.forEach(r => {
    console.log(`\n[id=${r.id}]`);
    if (r.data.success !== undefined) {
      const summary = { ...r.data };
      delete summary.fingerprint;
      delete summary.content;
      delete summary.data;
      console.log(JSON.stringify(summary, null, 2));
      if (r.data.content) {
        const c = String(r.data.content);
        console.log('content 前 200 字符:', c.slice(0, 200));
      }
      if (r.data.fingerprint) {
        console.log('fingerprint 字段:', Object.keys(r.data.fingerprint).join(','));
      }
    } else {
      console.log(JSON.stringify(r.data).slice(0, 300));
    }
  });
  
  child.kill();
  process.exit(0);
})();
