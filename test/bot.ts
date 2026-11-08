// A simple automated player, used to sanity-check difficulty and to generate realistic run logs.
// It reacts on a fixed cadence (like human reaction time) and sometimes picks the wrong lane.

import {
  EDGE_TICKS,
  EMPTY_SPEED,
  INPUT_MOVE_BASE,
  INPUT_PRESS_HERE,
  INPUT_RELEASE,
  LANES,
  MAX_TOTAL_TICKS,
  MUG_SPEED,
  POUR_TICKS,
  SIM_VERSION,
} from '../src/sim/constants';
import { nextRandom } from '../src/sim/rng';
import { createSim, step, type SimState } from '../src/sim/sim';
import { seedFor, type RunLog } from '../src/sim/replay';

export interface BotStyle {
  /** Ticks between decisions. ~6 is sharp, ~12 is casual, ~20 is distracted. */
  react: number;
  /** Chance (0-100) a decision goes to a random lane. */
  mistakePct: number;
  /** Seed for the bot's own randomness (not the game's). */
  seed: number;
}

export const IDLE: BotStyle = { react: 0, mistakePct: 0, seed: 1 };

interface LaneInfo {
  uncovered: number; // patrons not already targeted by an order in flight
  patronSlack: number; // ticks to spare before the first uncovered patron can no longer be served
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
      const slack = e.wait + Math.ceil(e.pos / EMPTY_SPEED) + EDGE_TICKS - e.edge;
      emptySlack = Math.min(emptySlack, slack);
    }
    info.push({
      uncovered: Math.max(0, queue.length - inFlight),
      patronSlack: p ? p.pos / p.speed - p.pos / (p.speed + MUG_SPEED) - POUR_TICKS : Infinity,
      emptySlack,
    });
  }
  return info;
}

export function playBot(period: string, style: BotStyle): RunLog {
  const s = createSim(seedFor(period));
  const inputs: number[] = [];
  let r = style.seed >>> 0;
  const roll = (n: number) => {
    const x = nextRandom(r);
    r = x.state;
    return x.value % n;
  };

  while (!s.over && s.tick < MAX_TOTAL_TICKS) {
    const t = s.tick + 1;
    const codes: number[] = [];
    if (style.react > 0 && t % style.react === 0 && s.stun === 0) {
      const info = lanes(s);
      // Earliest deadline first, across "serve the next patron" and "grab the next empty",
      // judged by eye: estimates are off by up to ±30%, like a person glancing at the screen.
      const eyeball = (x: number) => (x === Infinity ? x : (x * (70 + roll(61))) / 100);
      let target = -1;
      let best = Infinity;
      for (let l = 0; l < LANES; l++) {
        const slack = eyeball(Math.min(info[l].patronSlack, l === s.goatLane ? Infinity : info[l].emptySlack));
        if (slack < best) {
          best = slack;
          target = l;
        }
      }
      // Finish a pour in progress unless something else is about to go wrong.
      const here = info[s.goatLane];
      if (s.pouring && s.pour > 0 && here.uncovered > 0 && best > style.react) target = s.goatLane;
      if (target >= 0 && roll(100) < style.mistakePct) target = roll(LANES);

      if (target < 0) {
        if (s.pouring) codes.push(INPUT_RELEASE);
      } else if (target === s.goatLane) {
        if (info[target].uncovered > 0 && !s.pouring) codes.push(INPUT_PRESS_HERE);
        if (info[target].uncovered === 0 && s.pouring) codes.push(INPUT_RELEASE);
      } else if (info[target].uncovered > 0) {
        codes.push(target); // step over and pour
      } else {
        if (s.pouring) codes.push(INPUT_RELEASE);
        codes.push(INPUT_MOVE_BASE + target);
      }
    }
    for (const c of codes) inputs.push(t, c);
    step(s, codes);
  }
  return { v: SIM_VERSION, period, inputs, endTick: s.tick, score: s.score };
}
