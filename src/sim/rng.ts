// Deterministic helpers. Everything in src/sim must produce identical results in every
// browser and on the server, so: integers only, no Math.random, no Date, no Math.sin & co.

/** FNV-1a 32-bit string hash. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** One mulberry32 step. Returns [nextState, value] packed: state is advanced in place by the caller. */
export function nextRandom(state: number): { state: number; value: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { state: s, value: (t ^ (t >>> 14)) >>> 0 };
}
