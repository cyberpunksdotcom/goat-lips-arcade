// Run logs and verification. The browser records every input with the tick it landed on;
// replaying those inputs against the same seed must reproduce the exact score.

import {
  GAME_SLUG,
  INPUT_MOVE_BASE,
  INPUT_PRESS_HERE,
  INPUT_RELEASE,
  LANES,
  MAX_INPUTS,
  MAX_TOTAL_TICKS,
  SIM_VERSION,
} from './constants';
import { hashString } from './rng';
import { createSim, step, type SimState } from './sim';

export interface RunLog {
  /** SIM_VERSION the run was played on. */
  v: number;
  /** Competition period id, e.g. "2026-11-09" (week starting Monday Nov 9). Selects the seed. */
  period: string;
  /** Flat pairs: [tick, code, tick, code, ...], ticks non-decreasing, 1-based. */
  inputs: number[];
  endTick: number;
  score: number;
}

export type Verdict = { ok: true; score: number; endTick: number; served: number } | { ok: false; reason: string };

/** Everyone plays the same shift during a period, so scores are comparable. */
export function seedFor(period: string, version: number = SIM_VERSION): number {
  return hashString(`goat-lips|${GAME_SLUG}|v${version}|${period}`);
}

export function replay(log: Pick<RunLog, 'v' | 'period' | 'inputs' | 'endTick'>): { state: SimState; consumed: number } {
  const s = createSim(seedFor(log.period, log.v));
  const buf: number[] = [];
  let i = 0;
  for (let t = 1; t <= log.endTick && !s.over; t++) {
    buf.length = 0;
    while (i < log.inputs.length && log.inputs[i] === t) {
      buf.push(log.inputs[i + 1]);
      i += 2;
    }
    step(s, buf);
  }
  return { state: s, consumed: i };
}

const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);

function isValidCode(c: unknown): boolean {
  if (!isInt(c)) return false;
  if (c >= 0 && c < LANES) return true; // press lane
  if (c >= INPUT_MOVE_BASE && c < INPUT_MOVE_BASE + LANES) return true; // step to lane
  return c === INPUT_RELEASE || c === INPUT_PRESS_HERE;
}

export function verifyRun(log: RunLog): Verdict {
  if (!log || typeof log !== 'object') return { ok: false, reason: 'not a run' };
  if (log.v !== SIM_VERSION) return { ok: false, reason: 'old game version' };
  if (typeof log.period !== 'string' || !/^\d{4}-\d{2}(-\d{2})?$/.test(log.period)) return { ok: false, reason: 'bad period' };
  if (!isInt(log.endTick) || log.endTick < 1 || log.endTick > MAX_TOTAL_TICKS) return { ok: false, reason: 'bad length' };
  if (!isInt(log.score) || log.score < 0) return { ok: false, reason: 'bad score' };
  const inputs = log.inputs;
  if (!Array.isArray(inputs) || inputs.length % 2 !== 0 || inputs.length > MAX_INPUTS * 2) {
    return { ok: false, reason: 'bad inputs' };
  }
  let lastTick = 1;
  for (let i = 0; i < inputs.length; i += 2) {
    const t = inputs[i];
    const c = inputs[i + 1];
    if (!isInt(t) || t < lastTick || t > log.endTick) return { ok: false, reason: 'bad input timing' };
    if (!isValidCode(c)) return { ok: false, reason: 'bad input code' };
    lastTick = t;
  }

  const { state, consumed } = replay(log);
  if (!state.over) return { ok: false, reason: 'run did not finish' };
  if (state.tick !== log.endTick) return { ok: false, reason: 'length mismatch' };
  if (consumed !== inputs.length) return { ok: false, reason: 'inputs after the end' };
  if (state.score !== log.score) return { ok: false, reason: 'score mismatch' };
  return { ok: true, score: state.score, endTick: state.tick, served: state.served };
}
