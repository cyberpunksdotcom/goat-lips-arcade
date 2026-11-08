// Competition periods in venue time (America/Chicago, daylight saving included).
// A week is the half-open interval [Monday 00:00, next Monday 00:00) local time, so there is
// no "Sunday 11:59 PM" gap. Daylight saving changes at 2 AM on Sundays, so local midnight is
// never skipped or repeated, and Monday 00:00 always exists exactly once.

export const VENUE_TZ = 'America/Chicago';

export interface Period {
  kind: 'week' | 'month';
  /** Week: Monday's local date "YYYY-MM-DD". Month: "YYYY-MM". */
  id: string;
  startMs: number;
  endMs: number;
}

const DAY = 86_400_000;
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: VENUE_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

interface Local {
  y: number;
  m: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  dow: number; // 0 = Monday
}

function local(ms: number): Local {
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    y: +parts.year,
    m: +parts.month,
    d: +parts.day,
    h: +parts.hour,
    mi: +parts.minute,
    s: +parts.second,
    dow: WEEKDAYS.indexOf(parts.weekday),
  };
}

/** UTC instant for a wall-clock time in the venue's time zone. */
export function venueTimeToUtc(y: number, m: number, d: number, h = 0, mi = 0): number {
  const wall = Date.UTC(y, m - 1, d, h, mi);
  let guess = wall + 6 * 3_600_000; // CST first guess
  for (let i = 0; i < 3; i++) {
    const l = local(guess);
    const seen = Date.UTC(l.y, l.m - 1, l.d, l.h, l.mi, l.s);
    const diff = wall - seen;
    if (diff === 0) break;
    guess += diff;
  }
  return guess;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function weekOf(ms: number): Period {
  const l = local(ms);
  const monday = new Date(Date.UTC(l.y, l.m - 1, l.d - l.dow));
  const next = new Date(monday.getTime() + 7 * DAY);
  const y = monday.getUTCFullYear();
  const m = monday.getUTCMonth() + 1;
  const d = monday.getUTCDate();
  return {
    kind: 'week',
    id: `${y}-${pad(m)}-${pad(d)}`,
    startMs: venueTimeToUtc(y, m, d),
    endMs: venueTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate()),
  };
}

export function monthOf(ms: number): Period {
  const l = local(ms);
  const ny = l.m === 12 ? l.y + 1 : l.y;
  const nm = l.m === 12 ? 1 : l.m + 1;
  return {
    kind: 'month',
    id: `${l.y}-${pad(l.m)}`,
    startMs: venueTimeToUtc(l.y, l.m, 1),
    endMs: venueTimeToUtc(ny, nm, 1),
  };
}

/** Friendly label, e.g. "Nov 2 – Nov 8". */
export function weekLabel(p: Period): string {
  const f = new Intl.DateTimeFormat('en-US', { timeZone: VENUE_TZ, month: 'short', day: 'numeric' });
  return `${f.format(new Date(p.startMs))} – ${f.format(new Date(p.endMs - 1))}`;
}
