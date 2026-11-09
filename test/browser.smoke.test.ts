// End-to-end check in real Chrome: play a run with touch input on a phone-sized screen, then
// verify the recorded run with the same code the server will use.
// Run: CHROME_PATH=/path/to/chrome npm run smoke
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

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function lanePoint(lane: number, w: number, h: number, portrait: boolean): [number, number] {
  return portrait ? [(w / 4) * (lane + 0.5), h * 0.5] : [w * 0.5, 52 + ((h - 56) / 4) * (lane + 0.5)];
}

/** Alternates a double tap (step over, then toss a basket) with a long hold (pour a beer). */
async function playRandomly(page: Page, ms: number, w: number, h: number, portrait: boolean) {
  const start = Date.now();
  let i = 0;
  while (Date.now() - start < ms) {
    const over = await page.evaluate(() => !!(window as unknown as { __lastRun?: unknown }).__lastRun);
    if (over) break;
    const [x, y] = lanePoint((i * 7 + (i >> 2)) % 4, w, h, portrait);
    if (i % 2 === 0) {
      for (let k = 0; k < 2; k++) {
        await page.touchscreen.touchStart(x, y);
        await wait(70);
        await page.touchscreen.touchEnd();
        await wait(110);
      }
    } else {
      await page.touchscreen.touchStart(x, y);
      await wait(520);
      await page.touchscreen.touchEnd();
    }
    await wait(150);
    i++;
  }
}

// Only under `npm run smoke`, which builds dist-single first (a stale build would fail the check).
const RUN = !!CHROME && process.env.npm_lifecycle_event === 'smoke';

describe.skipIf(!RUN)('browser smoke test', () => {
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
      await playRandomly(page, 7_000, 390, 844, true);
      // Mid-pour: the beer meter should show at the end of the bar.
      const [hx, hy] = lanePoint(2, 390, 844, true);
      await page.touchscreen.touchStart(hx, hy);
      await wait(260);
      await page.screenshot({ path: `${OUT}/3-mid-portrait.png` });
      await page.touchscreen.touchEnd();
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
