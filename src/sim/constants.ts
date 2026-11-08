// Tuning knobs for "Slide 'Em". Any change that affects scoring must bump SIM_VERSION,
// and should only ship at a competition-period boundary (see docs/GAME-DESIGN.md).

export const SIM_VERSION = 1;
export const GAME_SLUG = 'slide-em';

export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

export const LANES = 4;
/** Lane length in fixed-point units. 0 = the goat's end of the bar, LANE_LEN = the door. */
export const LANE_LEN = 100_000;

export const START_LIPS = 3;

/** Ticks of holding to fill one order (~0.27 s). Holding longer keeps pouring. */
export const POUR_TICKS = 16;
/** Full orders slide toward the door. ~45 ticks to cross. */
export const MUG_SPEED = 2_200;
/** Empties slide back toward the goat. ~150 ticks to cross. */
export const EMPTY_SPEED = 650;
/** How long a served patron hangs on to a drink before sliding the empty back. Food doesn't come back. */
export const DRINK_TICKS = 50;
/** An empty teeters at the goat's end this long (~1.25 s) before it falls. Step into the lane to grab it. */
export const EDGE_TICKS = 75;
/** Pause after losing a lip; the room is cleared and play resumes. */
export const STUN_TICKS = 84;
/** First arrival after a reset. */
export const RESTART_SPAWN_TICKS = 40;

/** Minimum spacing between patrons queued in the same lane. */
export const PATRON_GAP = 9_000;
/** A lane needs this much room at the door before someone new walks in. */
export const DOOR_CLEAR = 12_000;

/** Difficulty reaches "full" after this many ticks of live play, then creeps toward max. */
export const RAMP_TICKS = 4 * 60 * TICK_HZ;
export const PATRON_SPEED_START = 170; // ~10 s from door to bar
export const PATRON_SPEED_FULL = 420; // ~4 s
export const PATRON_SPEED_MAX = 640; // ~2.6 s
export const PATRON_SPEED_JITTER_PCT = 12;
export const SPAWN_GAP_START = 135; // ~2.25 s between arrivals
export const SPAWN_GAP_FULL = 30; // ~0.5 s
export const SPAWN_GAP_MIN = 14; // ~0.23 s: more than any goat can pour
export const SPAWN_GAP_JITTER_PCT = 30;

export const PHASE_TICKS = 40 * TICK_HZ;
export const PHASES = ['Lunch Rush', 'Afternoon Jazz', 'Open Mic', 'Band Night', 'Last Call'] as const;
/** Chance (out of 100) that a patron wants food rather than a drink, per phase. Cosmetic only. */
export const CHEW_PCT_BY_PHASE = [70, 30, 35, 20, 25] as const;

/** The shift ends on its own after 15 minutes of live play ("closing time"). */
export const MAX_ACTIVE_TICKS = 15 * 60 * TICK_HZ;
export const MAX_TOTAL_TICKS = MAX_ACTIVE_TICKS + START_LIPS * STUN_TICKS + 600;

export const POINTS_SERVE = 100;
export const POINTS_CATCH = 50;
/** Every STREAK_STEP serves in a row raises the multiplier by one, up to MAX_MULT. */
export const STREAK_STEP = 8;
export const MAX_MULT = 5;

// Replay input codes
// 0..3  press on lane n (step over and start pouring)
// 4..7  step to lane n (keyboard arrows; keeps pouring if already holding)
// 8     release (stop pouring)
// 9     press where the goat stands (keyboard space)
export const INPUT_MOVE_BASE = 4;
export const INPUT_RELEASE = 8;
export const INPUT_PRESS_HERE = 9;
export const MAX_INPUTS = 30_000;
