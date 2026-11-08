import { describe, expect, it } from 'vitest';
import { LANE_LEN, POUR_TICKS, START_LIPS, TICK_HZ } from '../src/sim/constants';
import { nextRandom, hashString } from '../src/sim/rng';
import { replay, seedFor, verifyRun } from '../src/sim/replay';
import { createSim, step } from '../src/sim/sim';
import { IDLE, playBot } from './bot';

const PERIOD = '2026-11-09';

describe('rng', () => {
  it('is stable across runs and engines (golden values)', () => {
    expect(hashString('goat-lips')).toBe(hashString('goat-lips'));
    let s = 12345;
    const out: number[] = [];
    for (let i = 0; i < 3; i++) {
      const r = nextRandom(s);
      s = r.state;
      out.push(r.value);
    }
    // If these ever change, every stored replay breaks. Bump SIM_VERSION instead.
    expect(out).toMatchInlineSnapshot(`
      [
        4207900869,
        1317490944,
        2079646450,
      ]
    `);
  });
});

describe('sim', () => {
  it('an idle player loses all three lips to waiting patrons', () => {
    const log = playBot(PERIOD, IDLE);
    const { state } = replay(log);
    expect(state.over).toBe(true);
    expect(state.overReason).toBe('lips');
    expect(state.lips).toBe(0);
    expect(state.lastLoss).toBe('waited');
    expect(state.score).toBe(0);
    // Roughly half a minute to a minute of grace for a first-timer who just watches.
    expect(log.endTick / TICK_HZ).toBeGreaterThan(25);
    expect(log.endTick / TICK_HZ).toBeLessThan(70);
  });

  it('holding to pour into an empty lane wastes an order and costs a lip', () => {
    const s = createSim(seedFor(PERIOD));
    step(s, [3]); // press lane 3 before anyone has walked in
    let ticks = 0;
    while (s.lips === START_LIPS && ticks < 200) {
      step(s, []);
      ticks++;
    }
    expect(s.lastLoss).toBe('wasted');
    expect(ticks).toBeGreaterThan(POUR_TICKS);
  });

  it('a quick tap only moves the goat; it does not pour', () => {
    const s = createSim(seedFor(PERIOD));
    step(s, [2]);
    step(s, [8]);
    for (let i = 0; i < 60; i++) step(s, []);
    expect(s.goatLane).toBe(2);
    expect(s.orders.length + s.empties.length).toBe(0);
    expect(s.lips).toBe(START_LIPS);
  });

  function withOnePatron(wants: 0 | 1) {
    const s = createSim(seedFor(PERIOD));
    s.spawnIn = 10_000; // nobody else walks in
    s.patrons.push({ id: 999, lane: 2, pos: LANE_LEN, prev: LANE_LEN, speed: 150, look: 0, wants });
    step(s, [2]);
    for (let i = 1; i < POUR_TICKS; i++) step(s, []);
    step(s, [8]);
    while (s.served === 0 && !s.over) step(s, []);
    return s;
  }

  it('serving a drink scores, and the empty comes back to be caught', () => {
    const s = withOnePatron(1);
    expect(s.served).toBe(1);
    expect(s.score).toBe(100);
    expect(s.empties.length).toBe(1);
    while (s.empties.length > 0 && !s.over) step(s, []); // goat stays in lane 2
    expect(s.caught).toBe(1);
    expect(s.score).toBe(150);
  });

  it('food baskets do not come back', () => {
    const s = withOnePatron(0);
    expect(s.served).toBe(1);
    expect(s.empties.length).toBe(0);
  });

  it('an empty teeters at the edge before falling, so there is time to grab it', () => {
    const s = withOnePatron(1);
    step(s, [4]); // step to lane 0, away from the empty
    while (s.empties.length > 0 && s.empties[0].pos > 0) step(s, []);
    for (let i = 0; i < 40; i++) step(s, []); // ~2/3 s at the edge: still there
    expect(s.empties.length).toBe(1);
    expect(s.lips).toBe(START_LIPS);
    step(s, [6]); // step to lane 2
    step(s, []);
    expect(s.caught).toBe(1);
    expect(s.lips).toBe(START_LIPS);
  });

  it('an empty left too long falls and costs a lip', () => {
    const s = withOnePatron(1);
    step(s, [4]);
    while (s.lips === START_LIPS && !s.over) step(s, []);
    expect(s.lastLoss).toBe('dropped');
  });
});

describe('replay verification', () => {
  const log = playBot(PERIOD, { react: 9, mistakePct: 4, seed: 7 });

  it('re-simulates a real run to the identical score', () => {
    expect(log.score).toBeGreaterThan(0);
    const v = verifyRun(log);
    expect(v).toEqual({ ok: true, score: log.score, endTick: log.endTick, served: expect.any(Number) });
  });

  it('is deterministic: same inputs, same everything', () => {
    const a = replay(log).state;
    const b = replay(log).state;
    expect(a.score).toBe(b.score);
    expect(a.tick).toBe(b.tick);
    expect(a.rng).toBe(b.rng);
  });

  it('rejects an inflated score', () => {
    expect(verifyRun({ ...log, score: log.score + 100 })).toEqual({ ok: false, reason: 'score mismatch' });
  });

  it('rejects a run claimed for a different week (different shift)', () => {
    const v = verifyRun({ ...log, period: '2026-11-16' });
    expect(v.ok).toBe(false);
  });

  it('rejects a run that stops before game over', () => {
    expect(verifyRun({ ...log, endTick: log.endTick - 30 }).ok).toBe(false);
  });

  it('rejects inputs after the end and malformed input codes', () => {
    expect(verifyRun({ ...log, inputs: [...log.inputs, log.endTick + 5, 1] }).ok).toBe(false);
    expect(verifyRun({ ...log, inputs: [1, 42] })).toEqual({ ok: false, reason: 'bad input code' });
    expect(verifyRun({ ...log, inputs: [5, 1, 3, 1] })).toEqual({ ok: false, reason: 'bad input timing' });
  });

  it('rejects other game versions', () => {
    expect(verifyRun({ ...log, v: 999 })).toEqual({ ok: false, reason: 'old game version' });
  });
});
