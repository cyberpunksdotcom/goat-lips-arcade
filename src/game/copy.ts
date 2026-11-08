// Player-facing lines. Voice: warm, dry, specific; readable by a first-time guest.
// Avoid: "settle in", "lean in", generic "good vibes" taglines, "booze".

import type { LossReason, OverReason } from '../sim/sim';

export const LOSS_LINES: Record<LossReason, string[]> = {
  waited: ['Somebody waited too long.', 'That one gave up on you.', 'Left without ordering.'],
  wasted: ['Slid it to nobody.', 'That one went right out the door.', 'Nobody ordered that.'],
  dropped: ['Dropped an empty.', 'Missed the empty.', 'Empty hit the floor.'],
};

export const OVER_TITLES: Record<OverReason, string> = {
  lips: 'Out of lips!',
  closing: 'Closing time!',
};

export const OVER_LINES: Record<OverReason, string[]> = {
  lips: ['The rush won this round.', 'Shift’s over. The goats are still hungry.', 'Even the GOAT takes a break.'],
  closing: ['You worked the whole shift. Somebody get this goat a raise.'],
};

export function pick<T>(xs: readonly T[], n: number): T {
  return xs[Math.abs(n) % xs.length];
}

export function lipsLeftLine(n: number): string {
  if (n === 1) return 'Last lip. Careful now.';
  return `${n} lips left`;
}
