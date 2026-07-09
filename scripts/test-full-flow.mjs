// 完整真实流程：访问 httpbin 表单页 → 输入文字 → 提取 → 截图
import { spawn } from 'child_process';

const child = spawn('node', ['src/main/mcp/server.mjs'], {
  cwd: '/opt/kore-fingerprint',
  env: { ...process.env, KORE_MCP_MODE: 'stdio' },
  stdio: ['pipe', 'pipe', 'pipe']
});

let responses = '';
child.stdout.on('data', (chunk) => {
  const s = chunk.toString();
  responses += s;
});
child.stderr.on('data', () => {}); // 静默

const send = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let curId = 0;
const callTool = (name, args) => new Promise((resolve) => {
  curId++;
  send({ jsonrpc: '2.0', id: curId, method: 'tools/call', params: { name, arguments: args }});
});

(async () => {
  console.log('=== Day 4.2 完整真实流程测试 ===\n');
  
  await sleep(1500);
  send({ jsonrpc: '2.0', id: ++curId, method: 'initialize', params: {
    protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'flow-test', version: '1.0' }
  }});
  await sleep(1000);
  send({ jsonrpc: '2.0', id: ++curId, method: 'tools/list', params: {} });
  await sleep(500);
  
  console.log('1. 启动 Chromium (via get_fingerprint)...');
  const t1 = Date.now();
  await callTool('browser_get_fingerprint', { profileId: 'flow-test' });
  await sleep(4000);
  console.log(`   ✅ ${Date.now() - t1}ms`);
  
  console.log('\n2. 导航到 httpbin 表单页...');
  const t2 = Date.now();
  await callTool('browser_navigate', { url: 'https://httpbin.org/forms/post', profileId: 'flow-test' });
  await sleep(4000);
  console.log(`   ✅ ${Date.now() - t2}ms`);
  
  console.log('\n3. 提取页面标题（应该是 httpbin）...');
  await callTool('browser_extract', { profileId: 'flow-test', selector: 'h1', format: 'innerText' });
  await sleep(1500);
  
  console.log('\n4. 输入 custname (真实键盘)...');
  await callTool('browser_type', { profileId: 'flow-test', selector: 'input[name="custname"]', text: 'kore-fingerprint', delay: 30 });
  await sleep(3000);
  
  console.log('\n5. 输入电话号码...');
  await callTool('browser_type', { profileId: 'flow-test', selector: 'input[name="custtel"]', text: '18589080123', delay: 20 });
  await sleep(2500);
  
  console.log('\n6. 提取输入框值（验证输入成功）...');
  await callTool('browser_extract', { profileId: 'flow-test', selector: 'input[name="custname"]', format: 'text' });
  await sleep(1500);
  
  console.log('\n7. 截图（含输入值）...');
  await callTool('browser_screenshot', { profileId: 'flow-test', fullPage: false });
  await sleep(2000);
  
  // 找最后一个响应
  console.log('\n=== 所有响应 ===');
  const lines = responses.split('\n').filter(l => l.trim());
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.id >= 3 && obj.result?.content?.[0]?.text) {
        const text = obj.result.content[0].text;
        try {
          const parsed = JSON.parse(text);
          if (parsed.success !== undefined) {
            console.log(`\n[id=${obj.id}]`, JSON.stringify({ ...parsed, content: undefined, fingerprint: undefined }, null, 2));
            if (parsed.content) {
              const preview = String(parsed.content).slice(0, 150).replace(/\n/g, ' ');
              console.log(`   内容预览: ${preview}${parsed.content.length > 150 ? '...' : ''}`);
            }
          } else {
            console.log(`\n[id=${obj.id}]`, text.slice(0, 300));
          }
        } catch {
          console.log(`\n[id=${obj.id}]`, text.slice(0, 300));
        }
      }
    } catch {}
  }
  
  child.kill();
  process.exit(0);
})();
