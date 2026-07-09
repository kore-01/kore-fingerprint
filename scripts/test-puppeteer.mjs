// 独立测试：能否在 3.6G 内存服务器上启动 Puppeteer Chromium
import { browserPool } from '../src/main/mcp/core/browser-pool.mjs';
import { setTimeout as sleep } from 'timers/promises';

const startMem = process.memoryUsage();
console.log('启动时内存 RSS:', Math.round(startMem.rss / 1024 / 1024) + 'MB');
console.log();

console.log('1. ensureReady(default)...');
const t1 = Date.now();
const inst = await browserPool.ensureReady('default');
console.log(`   ✅ 实例创建完成 (${Date.now() - t1}ms)`);
console.log('   URL:', inst.url);
console.log('   指纹字段:', Object.keys(inst.fingerprint || {}).join(', '));
console.log();

const afterLaunch = process.memoryUsage();
console.log('2. 启动后 RSS:', Math.round(afterLaunch.rss / 1024 / 1024) + 'MB');
console.log('   增长:', Math.round((afterLaunch.rss - startMem.rss) / 1024 / 1024) + 'MB');
console.log();

console.log('3. 测试 get_fingerprint tool...');
const fp = inst.fingerprint;
console.log('   UA:', fp.ua);
console.log('   Languages:', JSON.stringify(fp.langs));
console.log('   Timezone:', fp.tz);
console.log('   Platform:', fp.platform);
console.log('   Cores:', fp.cores, '/ Memory:', fp.mem + 'GB');
console.log('   Screen:', JSON.stringify(fp.screen));
console.log('   WebGL vendor:', fp.webgl?.vendor);
console.log('   WebGL renderer:', fp.webgl?.renderer);
console.log('   Canvas hash (last 30):', fp.canvas);
console.log();

console.log('4. 测试 navigate 真实访问 example.com...');
const t2 = Date.now();
await inst.page.goto('https://example.com', { waitUntil: 'load', timeout: 30000 });
console.log(`   ✅ 导航完成 (${Date.now() - t2}ms)`);
console.log('   URL:', inst.page.url());
console.log('   Title:', await inst.page.title());
console.log();

const afterNav = process.memoryUsage();
console.log('5. 导航后 RSS:', Math.round(afterNav.rss / 1024 / 1024) + 'MB');
console.log('   增长:', Math.round((afterNav.rss - afterLaunch.rss) / 1024 / 1024) + 'MB');
console.log();

console.log('6. 测试 extract (提取页面文本)...');
const text = await inst.page.evaluate(() => document.body.innerText);
console.log('   页面内容（前 200 字符）:', text.slice(0, 200));
console.log();

console.log('7. 测试 screenshot...');
const buf = await inst.page.screenshot({ type: 'png' });
console.log('   ✅ 截图成功，大小:', Math.round(buf.length / 1024) + 'KB');
console.log('   Base64 长度:', buf.toString('base64').length);
console.log();

console.log('8. 关闭...');
await browserPool.closeAll();
console.log('   ✅ 已关闭');
console.log();

const final = process.memoryUsage();
console.log('=== 最终内存状态 ===');
console.log('   RSS:', Math.round(final.rss / 1024 / 1024) + 'MB');
console.log('   Heap:', Math.round(final.heapUsed / 1024 / 1024) + 'MB /', Math.round(final.heapTotal / 1024 / 1024) + 'MB');
console.log();

console.log('🎉 Puppeteer Chromium 在 3.6G 内存服务器上运行成功！');
