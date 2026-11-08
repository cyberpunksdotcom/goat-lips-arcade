// End-to-end check in real Chrome: play a run with touch input on a phone-sized screen, then
// verify the recorded run with the same code the server will use.
// Run: CHROME_PATH=/path/to/chrome npm run smoke   (skipped when CHROME_PATH is not set)
// Screenshots land in test-output/ (git-ignored).

import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import puppeteer, { type Page } from 'puppeteer-core';
import { describe, expect, it } from 'vitest';
import { verifyRun, type RunLog } from '../src/sim/replay';

const CHROME = process.env.CHROME_PATH;
const URL = pathToFileURL(resolve('dist-single/index.html')).href;
const OUT = resolve('test-output');

async function playRandomly(page: Page, ms: number, w: number, h: number, portrait: boolean) {
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < ms) {
    const over = await page.evaluate(() => !!(window as unknown as { __lastRun?: unknown }).__lastRun);
    if (over) break;
    const lane = (i * 7 + (i >> 2)) % 4;
    const x = portrait ? (w / 4) * (lane + 0.5) : w * 0.5;
    const y = portrait ? h * 0.5 : 52 + ((h - 56) / 4) * (lane + 0.5);
    await page.touchscreen.touchStart(x, y);
    await new Promise((r) => setTimeout(r, i % 3 === 0 ? 90 : 320));
    await page.touchscreen.touchEnd();
    await new Promise((r) => setTimeout(r, 160));
    i++;
  }
}

describe.skipIf(!CHROME)('browser smoke test', () => {
  it('plays on a phone in portrait and landscape; the browser run verifies exactly', async () => {
    mkdirSync(OUT, { recursive: true });
    const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    const errors: string[] = [];
    try {
      const page = await browser.newPage();
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

      // Portrait phone
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.goto(URL);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/1-title-portrait.png` });
      await page.tap('#play-btn');
      await new Promise((r) => setTimeout(r, 2600));
      await page.screenshot({ path: `${OUT}/2-start-portrait.png` });
      await playRandomly(page, 9_000, 390, 844, true);
      await page.screenshot({ path: `${OUT}/3-mid-portrait.png` });
      await playRandomly(page, 120_000, 390, 844, true);
      await page.waitForFunction(() => !!(window as unknown as { __lastRun?: unknown }).__lastRun, { timeout: 120_000 });
      await new Promise((r) => setTimeout(r, 900));
      await page.screenshot({ path: `${OUT}/4-over-portrait.png` });

      const run = (await page.evaluate(() => (window as unknown as { __lastRun: RunLog }).__lastRun)) as RunLog;
      const verdict = verifyRun(run);
      console.log('browser run:', { score: run.score, endTick: run.endTick, inputs: run.inputs.length / 2, verdict });
      expect(verdict.ok).toBe(true);

      // Landscape phone
      await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      await page.goto(URL);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${OUT}/5-title-landscape.png` });
      await page.tap('#play-btn');
      await new Promise((r) => setTimeout(r, 2600));
      await playRandomly(page, 12_000, 844, 390, false);
      await page.screenshot({ path: `${OUT}/6-mid-landscape.png` });
    } finally {
      await browser.close();
    }
    expect(errors).toEqual([]);
  }, 240_000);
});
