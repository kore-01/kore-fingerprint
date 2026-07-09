// kore-fingerprint MCP Browser Tools (Day 3: 真实 Puppeteer 集成)
// 6 tools: navigate / screenshot / click / type / extract / get_fingerprint

import { z } from 'zod';
import { Logger } from '../../utils/logger.mjs';
import { browserPool } from '../core/browser-pool.mjs';

const logger = new Logger('mcp:browser');

export function registerBrowserTools(server) {

  // Tool 1: browser_navigate
  server.tool(
    'browser_navigate',
    'Navigate the browser to a URL. Returns the page title and final URL after navigation.',
    {
      url: z.string().url().describe('The URL to navigate to (must include http:// or https://)'),
      profileId: z.string().optional().default('default'),
      waitUntil: z.enum(['load', 'domcontentloaded', 'networkidle0', 'networkidle2']).optional().default('load')
    },
    async ({ url, profileId, waitUntil }) => {
      try {
        logger.info(`navigate ${profileId} -> ${url}`);
        const inst = await browserPool.ensureReady(profileId);
        await inst.page.goto(url, { waitUntil, timeout: 30000 });
        inst.url = inst.page.url();
        inst.title = await inst.page.title();
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true, profileId, url: inst.url, title: inst.title, waitUntil
            }, null, 2)
          }]
        };
      } catch (error) {
        logger.error(`Navigate failed: ${error.message}`);
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  // Tool 2: browser_screenshot
  server.tool(
    'browser_screenshot',
    'Take a screenshot of the current page. Returns the image as base64-encoded PNG.',
    {
      profileId: z.string().optional().default('default'),
      fullPage: z.boolean().optional().default(false),
      format: z.enum(['png', 'jpeg']).optional().default('png')
    },
    async ({ profileId, fullPage, format }) => {
      try {
        const inst = await browserPool.ensureReady(profileId);
        const buffer = await inst.page.screenshot({ fullPage, type: format });
        const b64 = buffer.toString('base64');
        return {
          content: [
            { type: 'text', text: JSON.stringify({ success: true, profileId, url: inst.url, size: buffer.length, format, encoding: 'base64' }, null, 2) },
            { type: 'image', data: b64, mimeType: format === 'png' ? 'image/png' : 'image/jpeg' }
          ]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  // Tool 3: browser_click
  server.tool(
    'browser_click',
    'Click an element on the page. Supports CSS selector.',
    {
      selector: z.string().describe('CSS selector (e.g., #submit-btn, .login-button)'),
      profileId: z.string().optional().default('default'),
      timeout: z.number().optional().default(10000)
    },
    async ({ selector, profileId, timeout }) => {
      try {
        const inst = await browserPool.ensureReady(profileId);
        await inst.page.waitForSelector(selector, { timeout });
        await inst.page.click(selector);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, profileId, selector, clicked: true }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  // Tool 4: browser_type
  server.tool(
    'browser_type',
    'Type text into an input field. Simulates real keyboard input.',
    {
      selector: z.string().describe('CSS selector of the input field'),
      text: z.string().describe('Text to type'),
      profileId: z.string().optional().default('default'),
      delay: z.number().optional().default(50).describe('Delay between keystrokes in ms (0=instant, 50=human-like)')
    },
    async ({ selector, text, profileId, delay }) => {
      try {
        const inst = await browserPool.ensureReady(profileId);
        await inst.page.waitForSelector(selector, { timeout: 10000 });
        await inst.page.click(selector);
        if (delay > 0) {
          await inst.page.type(selector, text, { delay });
        } else {
          await inst.page.evaluate((sel, t) => {
            const el = document.querySelector(sel);
            if (el) {
              el.value = t;
              el.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, selector, text);
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, profileId, selector, textLength: text.length, mode: delay > 0 ? 'simulated' : 'instant' }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  // Tool 5: browser_extract
  server.tool(
    'browser_extract',
    'Extract text or HTML from the page or a specific element.',
    {
      profileId: z.string().optional().default('default'),
      selector: z.string().optional().describe('CSS selector to extract from (omit for full page)'),
      format: z.enum(['text', 'html', 'innerText']).optional().default('text')
    },
    async ({ profileId, selector, format }) => {
      try {
        const inst = await browserPool.ensureReady(profileId);
        const result = await inst.page.evaluate((sel, fmt) => {
          if (!sel) {
            if (fmt === 'html') return document.documentElement.outerHTML;
            return document.body.innerText;
          }
          const el = document.querySelector(sel);
          if (!el) return null;
          if (fmt === 'html') return el.outerHTML;
          if (fmt === 'innerText') return el.innerText;
          return el.textContent;
        }, selector, format);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, profileId, selector, format, length: result ? result.length : 0, content: result }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  // Tool 6: browser_get_fingerprint
  server.tool(
    'browser_get_fingerprint',
    'Get the current browser fingerprint configuration from real CDP. Verifies fingerprint isolation.',
    {
      profileId: z.string().optional().default('default')
    },
    async ({ profileId }) => {
      try {
        const inst = await browserPool.ensureReady(profileId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true, profileId,
              fingerprint: inst.fingerprint,
              currentUrl: inst.page.url(),
              currentTitle: await inst.page.title(),
              createdAt: new Date(inst.createdAt).toISOString(),
              activeProfiles: browserPool.list()
            }, null, 2)
          }]
        };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      }
    }
  );

  logger.info('Registered 6 browser tools: navigate, screenshot, click, type, extract, get_fingerprint');
}
