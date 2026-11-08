import { describe, expect, it } from 'vitest';
import { monthOf, venueTimeToUtc, weekLabel, weekOf } from '../src/period';

const H = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

describe('venue time', () => {
  it('converts Central wall-clock time to UTC across daylight saving', () => {
    expect(iso(venueTimeToUtc(2026, 11, 9))).toBe('2026-11-09T06:00:00.000Z'); // CST
    expect(iso(venueTimeToUtc(2026, 10, 26))).toBe('2026-10-26T05:00:00.000Z'); // CDT
    expect(iso(venueTimeToUtc(2027, 3, 15))).toBe('2027-03-15T05:00:00.000Z'); // CDT again
  });
});

describe('weekly periods: [Monday 00:00, next Monday 00:00) Central', () => {
  it('Sunday 11:59:59.999 PM belongs to the week that is ending', () => {
    const lastMoment = Date.parse('2026-11-09T05:59:59.999Z'); // Sun Nov 8, 11:59:59.999 PM CST
    expect(weekOf(lastMoment).id).toBe('2026-11-02');
  });

  it('Monday 12:00 AM starts the new week', () => {
    const p = weekOf(Date.parse('2026-11-09T06:00:00.000Z'));
    expect(p.id).toBe('2026-11-09');
    expect(iso(p.startMs)).toBe('2026-11-09T06:00:00.000Z');
    expect(iso(p.endMs)).toBe('2026-11-16T06:00:00.000Z');
    expect(weekLabel(p)).toBe('Nov 9 – Nov 15');
  });

  it('the week containing the fall-back change is 169 hours', () => {
    const p = weekOf(Date.parse('2026-10-30T12:00:00Z'));
    expect(p.id).toBe('2026-10-26');
    expect((p.endMs - p.startMs) / H).toBe(169);
  });

  it('the week containing the spring-forward change is 167 hours', () => {
    const p = weekOf(Date.parse('2027-03-10T12:00:00Z'));
    expect(p.id).toBe('2027-03-08');
    expect((p.endMs - p.startMs) / H).toBe(167);
  });

  it('weeks tile with no gaps or overlaps', () => {
    let t = Date.parse('2026-10-01T00:00:00Z');
    let prev = weekOf(t);
    for (let i = 0; i < 30; i++) {
      const next = weekOf(prev.endMs);
      expect(next.startMs).toBe(prev.endMs);
      expect(weekOf(next.startMs - 1).id).toBe(prev.id);
      prev = next;
    }
    t = prev.endMs;
    expect(t).toBeGreaterThan(0);
  });

  it('crosses the year boundary', () => {
    const p = weekOf(Date.parse('2027-01-01T18:00:00Z')); // Friday Jan 1, 2027
    expect(p.id).toBe('2026-12-28');
  });
});

describe('monthly periods', () => {
  it('uses Central midnight on the 1st', () => {
    const p = monthOf(Date.parse('2026-12-01T05:30:00Z')); // still Nov 30, 11:30 PM CST
    expect(p.id).toBe('2026-11');
    expect(iso(p.endMs)).toBe('2026-12-01T06:00:00.000Z');
  });
});
