// kore-fingerprint MCP Browser Tools (Day 2: 4 个核心 tools)

import { z } from 'zod';
import { Logger } from '../../utils/logger.mjs';

const logger = new Logger('mcp:browser');

class BrowserPool {
  constructor() {
    this.instances = new Map();
  }

  async ensureReady(profileId = 'default') {
    if (!this.instances.has(profileId)) {
      logger.info('Creating new browser instance for profile: ' + profileId);
      this.instances.set(profileId, {
        profileId,
        url: 'about:blank',
        title: '',
        fingerprint: this.generateFingerprint(),
        createdAt: Date.now()
      });
    }
    return this.instances.get(profileId);
  }

  generateFingerprint() {
    return {
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      timezone: 'Asia/Shanghai',
      locale: 'zh-CN',
      hardwareConcurrency: 8,
      deviceMemory: 8,
      webglVendor: 'Intel Inc.',
      webglRenderer: 'Mesa Intel(R) UHD Graphics 620',
      platform: 'Linux x86_64',
      screenResolution: '1920x1080',
      colorDepth: 24,
      pixelRatio: 1
    };
  }

  list() {
    return Array.from(this.instances.keys());
  }
}

const pool = new BrowserPool();

export function registerBrowserTools(server) {

  server.tool(
    'browser_navigate',
    'Navigate the browser to a URL. Returns the page title and final URL after navigation.',
    {
      url: z.string().url().describe('The URL to navigate to (must include http:// or https://)'),
      profileId: z.string().optional().default('default').describe('Profile ID to use (defaults to default)'),
      waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional().default('load').describe('When to consider navigation complete')
    },
    async ({ url, profileId, waitUntil }) => {
      try {
        logger.info('Navigate ' + profileId + ' -> ' + url);
        const instance = await pool.ensureReady(profileId);
        instance.url = url;
        instance.title = 'Mock title for ' + url;
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              profileId,
              url: instance.url,
              title: instance.title,
              waitUntil,
              note: 'Real Puppeteer integration coming in Day 3'
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error('Navigate failed: ' + error.message);
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  server.tool(
    'browser_screenshot',
    'Take a screenshot of the current page. Returns image as base64-encoded PNG.',
    {
      profileId: z.string().optional().default('default'),
      fullPage: z.boolean().optional().default(false).describe('Capture full scrollable page'),
      format: z.enum(['png', 'jpeg']).optional().default('png')
    },
    async ({ profileId, fullPage, format }) => {
      try {
        logger.info('Screenshot ' + profileId + ' (fullPage=' + fullPage + ', format=' + format + ')');
        const instance = await pool.ensureReady(profileId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              profileId,
              url: instance.url,
              mock: true,
              message: 'Screenshot will be implemented in Day 3 with real Puppeteer integration',
              estimatedSize: '~50KB'
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  server.tool(
    'browser_click',
    'Click an element on the page. Supports CSS selector.',
    {
      selector: z.string().describe('CSS selector (e.g., #submit-btn, .login-button)'),
      profileId: z.string().optional().default('default'),
      timeout: z.number().optional().default(5000).describe('Timeout in milliseconds')
    },
    async ({ selector, profileId, timeout }) => {
      try {
        logger.info('Click ' + profileId + ' -> ' + selector);
        const instance = await pool.ensureReady(profileId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              profileId,
              selector,
              timeout,
              message: 'Would click: ' + selector + ' (real Puppeteer integration in Day 3)'
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  server.tool(
    'browser_get_fingerprint',
    'Get the current browser fingerprint configuration (UA, viewport, timezone, etc). Useful for verifying fingerprint isolation.',
    {
      profileId: z.string().optional().default('default')
    },
    async ({ profileId }) => {
      try {
        logger.info('Get fingerprint ' + profileId);
        const instance = await pool.ensureReady(profileId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              profileId,
              fingerprint: instance.fingerprint,
              currentUrl: instance.url,
              createdAt: new Date(instance.createdAt).toISOString(),
              activeProfiles: pool.list()
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  logger.info('Registered 4 browser tools: navigate, screenshot, click, get_fingerprint');
}
