// 真实 Puppeteer 浏览器池
// 用 puppeteer-extra-plugin-stealth 反检测
// 3.6G 内存服务器优化：headless new + disable-gpu + no-sandbox

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Logger } from '../../utils/logger.mjs';

puppeteer.use(StealthPlugin());

const logger = new Logger('mcp:browser-pool');

// 浏览器参数（低内存优化）
const LAUNCH_OPTIONS = {
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-breakpad',
    '--disable-component-update',
    '--disable-default-apps',
    '--disable-domain-reliability',
    '--disable-extensions',
    '--disable-features=TranslateUI,BlinkGenPropertyTrees',
    '--disable-hang-monitor',
    '--disable-ipc-flooding-protection',
    '--disable-popup-blocking',
    '--disable-prompt-on-repost',
    '--disable-renderer-backgrounding',
    '--disable-sync',
    '--enable-automation',
    '--force-color-profile=srgb',
    '--metrics-recording-only',
    '--no-first-run',
    '--password-store=basic',
    '--use-mock-keychain',
    '--mute-audio',
    '--memory-pressure-off'
  ]
};

class BrowserPool {
  constructor() {
    /** @type {Map<string, {browser: any, page: any, context: any, fingerprint: object, createdAt: number}>} */
    this.instances = new Map();
    this.launching = new Map(); // 防止并发启动
  }

  /**
   * 启动 Puppeteer Chromium
   * @returns {Promise<import('puppeteer').Browser>}
   */
  async launchBrowser() {
    if (this.sharedBrowser && this.sharedBrowser.connected) {
      return this.sharedBrowser;
    }
    
    logger.info('Launching Chromium...');
    const startTime = Date.now();
    const browser = await puppeteer.launch(LAUNCH_OPTIONS);
    logger.info(`Chromium launched in ${Date.now() - startTime}ms`);
    this.sharedBrowser = browser;
    return browser;
  }

  /**
   * 获取/创建 profile 实例
   * @param {string} profileId
   * @returns {Promise<{browser: any, page: any, context: any, fingerprint: object, profileId: string, url: string, title: string}>}
   */
  async ensureReady(profileId = 'default') {
    if (this.instances.has(profileId)) {
      const inst = this.instances.get(profileId);
      if (inst.page && !inst.page.isClosed()) {
        return inst;
      }
      // page 已关闭，清理
      this.instances.delete(profileId);
    }

    // 防止并发启动
    if (this.launching.has(profileId)) {
      return await this.launching.get(profileId);
    }

    const launchPromise = this._createInstance(profileId);
    this.launching.set(profileId, launchPromise);

    try {
      const inst = await launchPromise;
      this.instances.set(profileId, inst);
      return inst;
    } finally {
      this.launching.delete(profileId);
    }
  }

  async _createInstance(profileId) {
    const browser = await this.launchBrowser();
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    
    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 });
    
    // 获取真实指纹
    const fingerprint = await this._captureFingerprint(page);
    
    const inst = {
      profileId,
      browser,
      page,
      context,
      fingerprint,
      url: 'about:blank',
      title: '',
      createdAt: Date.now()
    };

    // 监听 page 关闭
    page.on('close', () => {
      logger.info(`Page closed for profile ${profileId}`);
      this.instances.delete(profileId);
    });

    // 监听 title/url 变化
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        inst.url = frame.url();
      }
    });

    return inst;
  }

  async _captureFingerprint(page) {
    try {
      const fp = await page.evaluate(() => {
        const ua = navigator.userAgent;
        const langs = navigator.languages;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const platform = navigator.platform;
        const cores = navigator.hardwareConcurrency;
        const mem = navigator.deviceMemory;
        const screenInfo = {
          width: screen.width,
          height: screen.height,
          colorDepth: screen.colorDepth,
          pixelDepth: screen.pixelDepth
        };
        const canvas = (() => {
          try {
            const c = document.createElement('canvas');
            const ctx = c.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('fingerprint', 2, 15);
            return c.toDataURL().slice(-50); // 后 50 字符作为指纹
          } catch (e) { return 'error'; }
        })();
        const webgl = (() => {
          try {
            const c = document.createElement('canvas');
            const gl = c.getContext('webgl');
            if (!gl) return null;
            const dbg = gl.getExtension('WEBGL_debug_renderer_info');
            return {
              vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
              renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
            };
          } catch (e) { return null; }
        })();
        return { ua, langs, tz, platform, cores, mem, screen: screenInfo, canvas, webgl };
      });
      return fp;
    } catch (e) {
      logger.warn(`Fingerprint capture failed: ${e.message}`);
      return { error: e.message };
    }
  }

  list() {
    return Array.from(this.instances.keys());
  }

  async close(profileId) {
    const inst = this.instances.get(profileId);
    if (!inst) return false;
    try {
      if (inst.page && !inst.page.isClosed()) await inst.page.close();
      if (inst.context) await inst.context.close();
      this.instances.delete(profileId);
      return true;
    } catch (e) {
      logger.error(`Close failed: ${e.message}`);
      return false;
    }
  }

  async closeAll() {
    for (const [id] of this.instances) {
      await this.close(id);
    }
    if (this.sharedBrowser && this.sharedBrowser.connected) {
      await this.sharedBrowser.close();
    }
  }
}

export const browserPool = new BrowserPool();
