import { describe, it, expect } from 'vitest';
import { cronMatchesNow, fieldMatches } from '../utils/recurrenceScheduler.js';

describe('fieldMatches', () => {
  it('wildcard matches any value', () => {
    expect(fieldMatches('*', 0)).toBe(true);
    expect(fieldMatches('*', 59)).toBe(true);
    expect(fieldMatches('*', 31)).toBe(true);
  });

  it('exact number matches only that value', () => {
    expect(fieldMatches('5', 5)).toBe(true);
    expect(fieldMatches('5', 6)).toBe(false);
    expect(fieldMatches('0', 0)).toBe(true);
  });

  it('step syntax */N matches multiples', () => {
    expect(fieldMatches('*/5', 0)).toBe(true);
    expect(fieldMatches('*/5', 5)).toBe(true);
    expect(fieldMatches('*/5', 10)).toBe(true);
    expect(fieldMatches('*/5', 3)).toBe(false);
    expect(fieldMatches('*/15', 30)).toBe(true);
    expect(fieldMatches('*/15', 7)).toBe(false);
  });

  it('range N-M matches inclusive values', () => {
    expect(fieldMatches('1-5', 1)).toBe(true);
    expect(fieldMatches('1-5', 3)).toBe(true);
    expect(fieldMatches('1-5', 5)).toBe(true);
    expect(fieldMatches('1-5', 0)).toBe(false);
    expect(fieldMatches('1-5', 6)).toBe(false);
  });

  it('comma-separated list matches any listed value', () => {
    expect(fieldMatches('1,15', 1)).toBe(true);
    expect(fieldMatches('1,15', 15)).toBe(true);
    expect(fieldMatches('1,15', 2)).toBe(false);
    expect(fieldMatches('1,15,30', 30)).toBe(true);
  });

  it('returns false for invalid field patterns', () => {
    expect(fieldMatches('abc', 5)).toBe(false);
    expect(fieldMatches('', 0)).toBe(false);
  });
});

describe('cronMatchesNow', () => {
  it('all-wildcard cron matches any time', () => {
    const date = new Date(2026, 2, 16, 14, 30); // Mon Mar 16 2026 14:30
    expect(cronMatchesNow('* * * * *', date)).toBe(true);
  });

  it('exact minute/hour match', () => {
    const date = new Date(2026, 2, 16, 9, 0); // 09:00
    expect(cronMatchesNow('0 9 * * *', date)).toBe(true);
    expect(cronMatchesNow('0 10 * * *', date)).toBe(false);
  });

  it('step on minutes', () => {
    const date = new Date(2026, 2, 16, 12, 15);
    expect(cronMatchesNow('*/15 * * * *', date)).toBe(true);
    const date2 = new Date(2026, 2, 16, 12, 7);
    expect(cronMatchesNow('*/15 * * * *', date2)).toBe(false);
  });

  it('day of week field', () => {
    // Mar 16 2026 is a Monday (day 1)
    const monday = new Date(2026, 2, 16, 0, 0);
    expect(cronMatchesNow('0 0 * * 1', monday)).toBe(true);
    expect(cronMatchesNow('0 0 * * 5', monday)).toBe(false); // Friday
  });

  it('range on day of month', () => {
    const date = new Date(2026, 0, 3, 0, 0); // Jan 3
    expect(cronMatchesNow('0 0 1-5 * *', date)).toBe(true);
    const date2 = new Date(2026, 0, 10, 0, 0); // Jan 10
    expect(cronMatchesNow('0 0 1-5 * *', date2)).toBe(false);
  });

  it('comma list on month', () => {
    const jan = new Date(2026, 0, 1, 0, 0); // month = 1
    expect(cronMatchesNow('0 0 1 1,6 *', jan)).toBe(true);
    const mar = new Date(2026, 2, 1, 0, 0); // month = 3
    expect(cronMatchesNow('0 0 1 1,6 *', mar)).toBe(false);
  });

  it('rejects invalid cron (wrong field count)', () => {
    const date = new Date();
    expect(cronMatchesNow('* * *', date)).toBe(false);
    expect(cronMatchesNow('* * * * * *', date)).toBe(false);
    expect(cronMatchesNow('', date)).toBe(false);
  });
});
