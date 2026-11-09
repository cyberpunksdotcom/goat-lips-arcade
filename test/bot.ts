// A simple automated player, used to sanity-check difficulty and to generate realistic run logs.
// It reacts on a fixed cadence (like human reaction time), judges distances by eye, and sometimes
// picks the wrong bar or the wrong order.

import {
  BEER_TICKS,
  EDGE_TICKS,
  EMPTY_SPEED,
  INPUT_PRESS_HERE,
  INPUT_RELEASE,
  LANES,
  MAX_TOTAL_TICKS,
  MUG_SPEED,
  SIM_VERSION,
} from '../src/sim/constants';
import { nextRandom } from '../src/sim/rng';
import { createSim, step, type Kind, type SimState } from '../src/sim/sim';
import { seedFor, type RunLog } from '../src/sim/replay';

export interface BotStyle {
  /** Ticks between decisions. ~8 is sharp, ~14 is casual, ~22 is distracted. */
  react: number;
  /** Chance (0-100) a decision goes wrong: wrong bar or wrong order. */
  mistakePct: number;
  /** Seed for the bot's own randomness (not the game's). */
  seed: number;
}

export const IDLE: BotStyle = { react: 0, mistakePct: 0, seed: 1 };

interface LaneInfo {
  uncovered: number;
  wants: Kind | null; // what the next un-served patron wants
  patronSlack: number; // ticks to spare before that patron can no longer be served in time
  emptySlack: number; // ticks to spare before the next empty in this lane falls
}

function lanes(s: SimState): LaneInfo[] {
  const info: LaneInfo[] = [];
  for (let l = 0; l < LANES; l++) {
    const inFlight = s.orders.filter((o) => o.lane === l).length;
    const queue = s.patrons.filter((p) => p.lane === l);
    const p = queue[inFlight];
    let emptySlack = Infinity;
    for (const e of s.empties) {
      if (e.lane !== l) continue;
      emptySlack = Math.min(emptySlack, e.wait + Math.ceil(e.pos / EMPTY_SPEED) + EDGE_TICKS - e.edge);
    }
    const prep = p ? (p.wants === 1 ? BEER_TICKS + 2 : l === s.goatLane ? 3 : 7) : 0;
    info.push({
      uncovered: Math.max(0, queue.length - inFlight),
      wants: p ? p.wants : null,
      patronSlack: p ? p.pos / p.speed - p.pos / (p.speed + MUG_SPEED) - prep : Infinity,
      emptySlack,
    });
  }
  return info;
}

export function playBot(period: string, style: BotStyle): RunLog {
  const s = createSim(seedFor(period));
  const inputs: number[] = [];
  const plan: { at: number; code: number }[] = [];
  let r = style.seed >>> 0;
  const roll = (n: number) => {
    const x = nextRandom(r);
    r = x.state;
    return x.value % n;
  };

  while (!s.over && s.tick < MAX_TOTAL_TICKS) {
    const t = s.tick + 1;
    if (s.stun > 0) plan.length = 0;
    const codes: number[] = [];
    while (plan.length && plan[0].at <= t) codes.push(plan.shift()!.code);

    if (plan.length === 0 && codes.length === 0 && style.react > 0 && t % style.react === 0 && s.stun === 0) {
      const info = lanes(s);
      const eyeball = (x: number) => (x === Infinity ? x : (x * (70 + roll(61))) / 100);
      let target = -1;
      let forEmpty = false;
      let best = Infinity;
      for (let l = 0; l < LANES; l++) {
        const ps = eyeball(info[l].patronSlack);
        const es = l === s.goatLane ? Infinity : eyeball(info[l].emptySlack);
        if (ps < best) {
          best = ps;
          target = l;
          forEmpty = false;
        }
        if (es < best) {
          best = es;
          target = l;
          forEmpty = true;
        }
      }
      let kind: Kind | null = target >= 0 && !forEmpty ? info[target].wants : null;
      if (target >= 0 && roll(100) < style.mistakePct) {
        if (roll(2) === 0) target = roll(LANES);
        else if (kind !== null) kind = kind === 0 ? 1 : 0;
      }

      const act: [number, number][] = [];
      if (target < 0) {
        if (s.holding) act.push([0, INPUT_RELEASE]);
      } else if (kind === null) {
        // just step over (to grab an empty): a quick press-and-release on another bar never tosses
        if (target !== s.goatLane) act.push([0, target], [2, INPUT_RELEASE]);
      } else if (kind === 0) {
        if (target !== s.goatLane) act.push([0, target], [2, INPUT_RELEASE], [4, INPUT_PRESS_HERE], [6, INPUT_RELEASE]);
        else act.push([0, INPUT_PRESS_HERE], [2, INPUT_RELEASE]);
      } else {
        act.push([0, target === s.goatLane ? INPUT_PRESS_HERE : target], [BEER_TICKS + 1, INPUT_RELEASE]);
      }
      for (const [dt, code] of act) {
        if (dt === 0) codes.push(code);
        else plan.push({ at: t + dt, code });
      }
    }
    for (const c of codes) inputs.push(t, c);
    step(s, codes);
  }
  return { v: SIM_VERSION, period, inputs, endTick: s.tick, score: s.score };
}
