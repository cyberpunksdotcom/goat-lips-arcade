// Renders scripts/og/og.html to public/og.jpg (1200×630 link-preview image).
// Usage: CHROME_PATH=/path/to/chrome node scripts/make-og.mjs
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer from 'puppeteer-core';

const chrome = process.env.CHROME_PATH;
if (!chrome) throw new Error('Set CHROME_PATH to a Chrome/Chromium binary');
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve('scripts/og/og.html')).href, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
mkdirSync('public', { recursive: true });
await page.screenshot({ path: 'public/og.jpg', type: 'jpeg', quality: 86, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log('wrote public/og.jpg');
