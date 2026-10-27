import { describe, expect, it } from 'vitest';
import { dailyLimit, estimateEnd, hourlyRate, warmupCap, warmupDay, warmupDoneDay, type Cadence } from './sending';

const ses: Cadence = {
  perMinute: 2, perHour: 60, perDay: 400,
  days: [1, 2, 3, 4, 5], fromHour: 8, toHour: 18,
  warmup: { enabled: true, start: 30, growth: 15, cap: 400, since: new Date(2026, 9, 16) },
};
const tuesday = new Date(2026, 9, 27, 10, 15);

describe('warm-up', () => {
  it('counts days from the go-live date', () => {
    expect(warmupDay(ses, new Date(2026, 9, 16, 23))).toBe(1);
    expect(warmupDay(ses, tuesday)).toBe(12);
  });

  it('grows by the daily rate and stops at the ceiling', () => {
    expect(warmupCap(ses.warmup, 1)).toBe(30);
    expect(warmupCap(ses.warmup, 12)).toBe(140);
    expect(warmupCap(ses.warmup, 40)).toBe(400);
    expect(warmupCap(ses.warmup, 0)).toBe(0);
  });

  it('finds the day the ceiling is reached', () => {
    expect(warmupDoneDay(ses.warmup)).toBe(20);
    expect(warmupCap(ses.warmup, 19)).toBeLessThan(400);
    expect(warmupCap(ses.warmup, 20)).toBe(400);
    expect(warmupDoneDay({ ...ses.warmup, growth: 0 })).toBeNull();
  });

  it('lowers the daily limit only while the warm-up is on', () => {
    expect(dailyLimit(ses, tuesday)).toBe(140);
    expect(dailyLimit({ ...ses, warmup: { ...ses.warmup, enabled: false } }, tuesday)).toBe(400);
  });
});

describe('estimateEnd', () => {
  it('uses the lowest of the per-minute and per-hour rates', () => {
    expect(hourlyRate(ses)).toBe(60);
    expect(hourlyRate({ ...ses, perMinute: 0.5 })).toBe(30);
  });

  it('carries over to the next day once today’s limit is used', () => {
    // 140 allowed today, 74 already sent: 66 more today, the remaining 108 tomorrow.
    const { end, days } = estimateEnd(ses, 174, tuesday, 74);
    expect(days).toBe(2);
    expect(end?.getDate()).toBe(28);
    expect(end?.getHours()).toBe(9);
  });

  it('skips days and hours outside the sending window', () => {
    const friday = new Date(2026, 9, 30, 17, 30);
    const { end } = estimateEnd({ ...ses, warmup: { ...ses.warmup, enabled: false } }, 100, friday);
    expect(end?.getDay()).toBe(1); // Monday
  });

  it('gives up when nothing can be sent', () => {
    expect(estimateEnd({ ...ses, perHour: 0 }, 10, tuesday).end).toBeNull();
  });
});
