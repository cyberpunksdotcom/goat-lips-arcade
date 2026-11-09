// "Slide 'Em": deterministic game simulation.
// Pure logic, no DOM. The browser runs it to play; the server will re-run it from the
// recorded inputs to verify a score before it can win anything.

import {
  CHEW_PCT_BY_PHASE,
  DOOR_CLEAR,
  DRINK_TICKS,
  EDGE_TICKS,
  EMPTY_SPEED,
  INPUT_MOVE_BASE,
  INPUT_PRESS_HERE,
  INPUT_RELEASE,
  LANES,
  LANE_LEN,
  MAX_ACTIVE_TICKS,
  MAX_MULT,
  MUG_SPEED,
  PATRON_GAP,
  PATRON_SPEED_FULL,
  PATRON_SPEED_JITTER_PCT,
  PATRON_SPEED_MAX,
  PATRON_SPEED_START,
  PHASES,
  PHASE_TICKS,
  BEER_TICKS,
  POINTS_BREW,
  POINTS_CATCH,
  POINTS_CHEW,
  TAP_TICKS,
  RAMP_TICKS,
  RESTART_SPAWN_TICKS,
  SIM_VERSION,
  SPAWN_GAP_FULL,
  SPAWN_GAP_JITTER_PCT,
  SPAWN_GAP_MIN,
  SPAWN_GAP_START,
  START_LIPS,
  STREAK_STEP,
  STUN_TICKS,
} from './constants';
import { nextRandom } from './rng';

/** 0 = chew (sandwich basket, tossed with a tap), 1 = brew (beer, poured with a hold). */
export type Kind = 0 | 1;
export type LossReason = 'waited' | 'wasted' | 'dropped';
export type OverReason = 'lips' | 'closing';

export interface Patron {
  id: number;
  lane: number;
  pos: number;
  prev: number;
  speed: number;
  look: number;
  wants: Kind;
}
export interface Order {
  id: number;
  lane: number;
  pos: number;
  prev: number;
  kind: Kind;
}
export interface Empty extends Order {
  /** Ticks left before it starts sliding back (patron still drinking). */
  wait: number;
  /** Ticks spent teetering at the goat's end. Falls at EDGE_TICKS. */
  edge: number;
}

export type SimEvent =
  | { t: 'launch'; lane: number; kind: Kind }
  | { t: 'serve'; lane: number; pos: number; points: number; mult: number; look: number; kind: Kind }
  | { t: 'refuse'; lane: number; pos: number; wanted: Kind }
  | { t: 'catch'; lane: number; points: number }
  | { t: 'loss'; reason: LossReason; lane: number; pos: number; lipsLeft: number }
  | { t: 'phase'; index: number }
  | { t: 'over'; reason: OverReason };

export interface SimState {
  version: number;
  rng: number;
  /** Ticks stepped so far, including pauses after a lost lip. Replay inputs are keyed to this. */
  tick: number;
  /** Ticks of live play. Drives difficulty and phases. */
  active: number;
  lips: number;
  score: number;
  streak: number;
  served: number;
  caught: number;
  /** Wrong orders sent back. */
  refused: number;
  goatLane: number;
  /** Finger (or Space) is down. */
  holding: boolean;
  /** Ticks held so far; resets each time a beer slides out. */
  held: number;
  /** This press began by stepping to another bar, so letting go doesn't toss a basket. */
  holdMoved: boolean;
  /** A beer already slid out during this press, so letting go doesn't toss a basket. */
  holdPoured: boolean;
  stun: number;
  spawnIn: number;
  phase: number;
  nextId: number;
  patrons: Patron[];
  orders: Order[];
  empties: Empty[];
  over: boolean;
  overReason: OverReason | null;
  lastLoss: LossReason | null;
  /** Events from the most recent step only. */
  events: SimEvent[];
}

export function createSim(seed: number): SimState {
  return {
    version: SIM_VERSION,
    rng: seed >>> 0,
    tick: 0,
    active: 0,
    lips: START_LIPS,
    score: 0,
    streak: 0,
    served: 0,
    caught: 0,
    refused: 0,
    goatLane: 1,
    holding: false,
    held: 0,
    holdMoved: false,
    holdPoured: false,
    stun: 0,
    spawnIn: 30,
    phase: 0,
    nextId: 1,
    patrons: [],
    orders: [],
    empties: [],
    over: false,
    overReason: null,
    lastLoss: null,
    events: [],
  };
}

export function multiplier(streak: number): number {
  return Math.min(MAX_MULT, 1 + Math.floor(streak / STREAK_STEP));
}

/** Advance one tick. `inputs` are the input codes that arrived for this tick, in order. */
export function step(s: SimState, inputs: readonly number[]): void {
  s.events.length = 0;
  if (s.over) return;
  s.tick++;

  for (const code of inputs) applyInput(s, code);

  if (s.stun > 0) {
    s.stun--;
    return;
  }

  s.active++;
  if (s.active >= MAX_ACTIVE_TICKS) {
    end(s, 'closing');
    return;
  }
  const phase = Math.min(PHASES.length - 1, Math.floor(s.active / PHASE_TICKS));
  if (phase !== s.phase) {
    s.phase = phase;
    s.events.push({ t: 'phase', index: phase });
  }

  for (const p of s.patrons) p.prev = p.pos;
  for (const o of s.orders) o.prev = o.pos;
  for (const e of s.empties) e.prev = e.pos;

  // Holding pours a beer; it slides out when full, and keeps pouring while held.
  if (s.holding) {
    s.held++;
    if (s.held >= BEER_TICKS) {
      s.held = 0;
      s.holdPoured = true;
      launch(s, 1);
    }
  }

  s.spawnIn--;
  if (s.spawnIn <= 0) spawn(s);

  let loss: { reason: LossReason; lane: number; pos: number } | null = null;

  // Patrons walk toward the bar, queueing behind whoever is ahead of them in their lane.
  const frontPos = new Array<number>(LANES).fill(-Infinity);
  const keptPatrons: Patron[] = [];
  for (const p of s.patrons) {
    p.pos = Math.max(p.pos - p.speed, frontPos[p.lane] + PATRON_GAP);
    if (p.pos <= 0) {
      if (!loss) loss = { reason: 'waited', lane: p.lane, pos: 0 };
      continue;
    }
    frontPos[p.lane] = p.pos;
    keptPatrons.push(p);
  }
  s.patrons = keptPatrons;

  // Orders slide toward the door; the first patron they reach takes them.
  const keptOrders: Order[] = [];
  for (const o of s.orders) {
    o.pos += MUG_SPEED;
    const target = frontPatron(s, o.lane);
    if (target && o.pos >= target.pos) {
      if (o.kind === target.wants) serve(s, target, o);
      else refuse(s, target);
      continue;
    }
    if (o.pos >= LANE_LEN) {
      if (!loss) loss = { reason: 'wasted', lane: o.lane, pos: LANE_LEN };
      continue;
    }
    keptOrders.push(o);
  }
  s.orders = keptOrders;

  // Empty mugs wait while the patron finishes, slide back, then teeter at the goat's end.
  // The goat grabs one by standing in that lane before it falls.
  const keptEmpties: Empty[] = [];
  for (const e of s.empties) {
    if (e.wait > 0) {
      e.wait--;
      keptEmpties.push(e);
      continue;
    }
    if (e.pos > 0) e.pos = Math.max(0, e.pos - EMPTY_SPEED);
    if (e.pos === 0) {
      if (s.goatLane === e.lane) {
        s.score += POINTS_CATCH;
        s.caught++;
        s.events.push({ t: 'catch', lane: e.lane, points: POINTS_CATCH });
        continue;
      }
      if (e.edge >= EDGE_TICKS) {
        if (!loss) loss = { reason: 'dropped', lane: e.lane, pos: 0 };
        continue;
      }
      e.edge++;
    }
    keptEmpties.push(e);
  }
  s.empties = keptEmpties;

  if (loss) loseLip(s, loss.reason, loss.lane, loss.pos);
}

function applyInput(s: SimState, code: number): void {
  if (s.over || s.stun > 0) return;
  if (code >= 0 && code < LANES) {
    // Press on a bar. Elsewhere: step there (holding still pours a beer there). Here: tap or hold.
    const moved = code !== s.goatLane;
    s.goatLane = code;
    startHold(s, moved);
  } else if (code >= INPUT_MOVE_BASE && code < INPUT_MOVE_BASE + LANES) {
    const lane = code - INPUT_MOVE_BASE;
    if (lane !== s.goatLane) {
      s.goatLane = lane;
      if (s.holding) {
        s.held = 0;
        s.holdMoved = true;
      }
    }
  } else if (code === INPUT_RELEASE) {
    if (s.holding && !s.holdMoved && !s.holdPoured && s.held <= TAP_TICKS) launch(s, 0);
    s.holding = false;
    s.held = 0;
  } else if (code === INPUT_PRESS_HERE) {
    startHold(s, false);
  }
}

function startHold(s: SimState, moved: boolean): void {
  s.holding = true;
  s.held = 0;
  s.holdMoved = moved;
  s.holdPoured = false;
}

function rand(s: SimState, n: number): number {
  const r = nextRandom(s.rng);
  s.rng = r.state;
  return r.value % n;
}

function jitter(s: SimState, base: number, pct: number): number {
  const j = Math.floor((base * pct) / 100);
  return j > 0 ? base + rand(s, 2 * j + 1) - j : base;
}

/** Linear ramp from `start` to `full` over RAMP_TICKS, then creeping toward `max` over 2×RAMP_TICKS. */
function ramp(s: SimState, start: number, full: number, max: number): number {
  const a = s.active;
  if (a <= RAMP_TICKS) return start + Math.trunc(((full - start) * a) / RAMP_TICKS);
  const extra = Math.min(a - RAMP_TICKS, 2 * RAMP_TICKS);
  return full + Math.trunc(((max - full) * extra) / (2 * RAMP_TICKS));
}

function frontPatron(s: SimState, lane: number): Patron | undefined {
  // Patrons in a lane never pass each other, so the earliest one in the array is the front.
  for (const p of s.patrons) if (p.lane === lane) return p;
  return undefined;
}

function launch(s: SimState, kind: Kind): void {
  const lane = s.goatLane;
  s.orders.push({ id: s.nextId++, lane, pos: 0, prev: 0, kind });
  s.events.push({ t: 'launch', lane, kind });
}

function spawn(s: SimState): void {
  const first = rand(s, LANES);
  for (let i = 0; i < LANES; i++) {
    const lane = (first + i) % LANES;
    let clear = true;
    for (const p of s.patrons) {
      if (p.lane === lane && p.pos > LANE_LEN - DOOR_CLEAR) {
        clear = false;
        break;
      }
    }
    if (!clear) continue;
    const speed = jitter(s, ramp(s, PATRON_SPEED_START, PATRON_SPEED_FULL, PATRON_SPEED_MAX), PATRON_SPEED_JITTER_PCT);
    const look = rand(s, 4);
    const wants: Kind = rand(s, 100) < CHEW_PCT_BY_PHASE[s.phase] ? 0 : 1;
    s.patrons.push({ id: s.nextId++, lane, pos: LANE_LEN, prev: LANE_LEN, speed, look, wants });
    s.spawnIn = jitter(s, ramp(s, SPAWN_GAP_START, SPAWN_GAP_FULL, SPAWN_GAP_MIN), SPAWN_GAP_JITTER_PCT);
    return;
  }
  s.spawnIn = 10; // every door is crowded; try again shortly
}

function serve(s: SimState, p: Patron, o: Order): void {
  s.patrons.splice(s.patrons.indexOf(p), 1);
  s.streak++;
  s.served++;
  const mult = multiplier(s.streak);
  const points = (o.kind === 0 ? POINTS_CHEW : POINTS_BREW) * mult;
  s.score += points;
  if (o.kind === 1) {
    s.empties.push({ id: s.nextId++, lane: p.lane, pos: p.pos, prev: p.pos, kind: 1, wait: DRINK_TICKS, edge: 0 });
  }
  s.events.push({ t: 'serve', lane: p.lane, pos: p.pos, points, mult, look: p.look, kind: o.kind });
}

/** Wrong order: the patron sends it back and keeps waiting for what they asked for. */
function refuse(s: SimState, p: Patron): void {
  s.streak = 0;
  s.refused++;
  s.events.push({ t: 'refuse', lane: p.lane, pos: p.pos, wanted: p.wants });
}

function loseLip(s: SimState, reason: LossReason, lane: number, pos: number): void {
  s.lips--;
  s.streak = 0;
  s.lastLoss = reason;
  s.events.push({ t: 'loss', reason, lane, pos, lipsLeft: s.lips });
  if (s.lips <= 0) {
    end(s, 'lips');
    return;
  }
  s.stun = STUN_TICKS;
  s.patrons = [];
  s.orders = [];
  s.empties = [];
  s.holding = false;
  s.held = 0;
  s.spawnIn = RESTART_SPAWN_TICKS;
}

function end(s: SimState, reason: OverReason): void {
  s.over = true;
  s.overReason = reason;
  s.holding = false;
  s.events.push({ t: 'over', reason });
}
