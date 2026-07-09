// 智核 OCR 验证码识别 (Day 4 改进版)
// 本地 tesseract → Hermes Vision fallback

import { z } from 'zod';
import { Logger } from '../../utils/logger.mjs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);
const logger = new Logger('mcp:ocr');

const HERMES_VISION_API = 'https://api.minimaxi.com/v1/text/chatcompletion_v2';
const HERMES_API_KEY = process.env.HERMES_API_KEY || 'sk-cp-Z46W0w8owBWCemXIR8idX5L9FOi_JslkqExT4TuRRJkrS59ERAeMCm_xUzcBXxxQooj6F7WKrwJSy_5sq12sAvP-W-00CKzoPuLUfCICkMVi_OylS9MZtAs';

export function registerOCRTools(server) {

  server.tool(
    'browser_solve_captcha',
    'Solve a captcha image. Tries local tesseract OCR first, falls back to Hermes Vision API for complex captchas.',
    {
      imageBase64: z.string().describe('Base64-encoded image of the captcha'),
      mode: z.enum(['auto', 'ocr', 'vision']).optional().default('auto')
    },
    async ({ imageBase64, mode }) => {
      const startTime = Date.now();
      const tmpFile = join(tmpdir(), `captcha-${randomUUID()}.png`);

      try {
        // 1. 保存图片
        writeFileSync(tmpFile, Buffer.from(imageBase64, 'base64'));
        logger.info(`Captcha saved: ${tmpFile} (${imageBase64.length} b64 chars)`);

        // 2. 优先 tesseract 本地 OCR
        if (mode === 'auto' || mode === 'ocr') {
          try {
            const { stdout } = await execAsync(`tesseract ${tmpFile} stdout 2>/dev/null`);
            const text = stdout.trim();
            // 启发式：4-8 字符，纯字母数字
            if (/^[a-zA-Z0-9]{4,8}$/.test(text)) {
              logger.info(`OCR success: ${text} (${Date.now() - startTime}ms)`);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({
                    success: true, method: 'tesseract', text, confidence: 'medium', latency_ms: Date.now() - startTime
                  }, null, 2)
                }]
              };
            }
            logger.warn(`OCR result invalid: "${text}", falling back to Vision`);
          } catch (e) {
            logger.warn(`OCR failed: ${e.message}, falling back to Vision`);
          }
        }

        // 3. Hermes Vision fallback
        if (mode === 'auto' || mode === 'vision') {
          try {
            const result = await callHermesVision(tmpFile);
            logger.info(`Vision success: ${result} (${Date.now() - startTime}ms)`);
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: true, method: 'vision', text: result, confidence: 'high', latency_ms: Date.now() - startTime
                }, null, 2)
              }]
            };
          } catch (e) {
            logger.error(`Vision failed: ${e.message}`);
            return { content: [{ type: 'text', text: 'Error: All captcha methods failed. Last error: ' + e.message }], isError: true };
          }
        }

        return { content: [{ type: 'text', text: 'Error: No method available' }], isError: true };
      } catch (error) {
        return { content: [{ type: 'text', text: 'Error: ' + error.message }], isError: true };
      } finally {
        try { require('fs').unlinkSync(tmpFile); } catch (e) {}
      }
    }
  );

  logger.info('Registered 1 OCR tool: solve_captcha');
}

async function callHermesVision(imagePath) {
  const imageBase64 = readFileSync(imagePath).toString('base64');
  const body = {
    model: 'MiniMax-Text-01',
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
        { type: 'text', text: 'Read the characters/digits in this CAPTCHA image. Respond with ONLY the captcha text, no other words.' }
      ]
    }],
    max_tokens: 50,
    temperature: 0.0
  };

  const response = await fetch(HERMES_VISION_API, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HERMES_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) throw new Error(`Hermes API ${response.status}: ${await response.text()}`);

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '';
}
