// Difficulty check: `npm run tune` prints how long different kinds of players last.
// Targets (see docs/GAME-DESIGN.md): idle ~30-60 s, distracted ~1-2 min, casual ~2-4 min,
// sharp ~4-8 min, with "closing time" (15 min) a rare feat.

import { describe, expect, it } from 'vitest';
import { TICK_HZ } from '../src/sim/constants';
import { replay } from '../src/sim/replay';
import { IDLE, playBot, type BotStyle } from './bot';

const WEEKS = ['2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07', '2026-12-14'];
const STYLES: Record<string, BotStyle> = {
  idle: IDLE,
  distracted: { react: 22, mistakePct: 15, seed: 3 },
  casual: { react: 14, mistakePct: 8, seed: 5 },
  sharp: { react: 8, mistakePct: 3, seed: 9 },
};

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

describe('balance', () => {
  const results: Record<string, { secs: number[]; scores: number[]; reasons: string[] }> = {};
  for (const [name, style] of Object.entries(STYLES)) {
    results[name] = { secs: [], scores: [], reasons: [] };
    for (const [i, week] of WEEKS.entries()) {
      const log = playBot(week, { ...style, seed: style.seed + i * 101 });
      const { state } = replay(log);
      results[name].secs.push(state.active / TICK_HZ);
      results[name].scores.push(state.score);
      results[name].reasons.push(`${state.lastLoss}/${state.overReason}`);
    }
  }

  it('prints a difficulty report', () => {
    const rows = Object.entries(results).map(([name, r]) => ({
      player: name,
      'median secs': Math.round(median(r.secs)),
      'min..max secs': `${Math.round(Math.min(...r.secs))}..${Math.round(Math.max(...r.secs))}`,
      'median score': median(r.scores),
      'final losses': [...new Set(r.reasons)].join(' '),
    }));
    console.table(rows);
    expect(rows.length).toBe(4);
  });

  it('better play lasts longer and scores more', () => {
    const m = (k: string) => median(results[k].scores);
    expect(m('sharp')).toBeGreaterThan(m('casual'));
    expect(m('casual')).toBeGreaterThan(m('distracted'));
    expect(m('distracted')).toBeGreaterThan(m('idle'));
  });
});
