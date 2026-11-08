// localStorage is a convenience only (best score, sound preference). It can be missing or throw
// (private mode, embedded views), so every call is guarded. It is never the competition record.

const PREFIX = 'goatlips.arcade.';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
