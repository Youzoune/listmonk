import { describe, expect, it } from 'vitest';
import { EMPTY_CADENCE, EMPTY_WARMUP, cadenceSummary, hasCadence, parseDay, relayName, toCadence, windowSummary } from './relays';
import { dailyLimit, estimateEnd, hourlyRate } from './sending';

const ses = {
  cadence: { per_minute: 2, per_hour: 60, per_day: 400, days: [1, 2, 3, 4, 5], from_hour: 8, to_hour: 18, timezone: 'Europe/Paris' },
  warmup: { enabled: true, start: 30, growth: 15, cap: 400, since: '2026-10-16' },
};

describe('toCadence', () => {
  it('matches the server limiter on the reference relay', () => {
    const c = toCadence(ses.cadence, ses.warmup);
    const tuesday = new Date(2026, 9, 27, 10, 15);
    expect(dailyLimit(c, tuesday)).toBe(140);
    expect(hourlyRate(c)).toBe(60);
    const { end, days } = estimateEnd(c, 174, tuesday, 74);
    expect(days).toBe(2);
    expect(end?.getDate()).toBe(28);
  });

  it('treats zeros as no limit', () => {
    const c = toCadence(EMPTY_CADENCE, EMPTY_WARMUP);
    expect(c.days).toHaveLength(7);
    expect(c.fromHour).toBe(0);
    expect(c.toHour).toBe(24);
    const start = new Date(2026, 9, 27, 10, 0);
    expect(estimateEnd(c, 5000, start).end?.getTime()).toBe(start.getTime());
  });
});

describe('summaries', () => {
  it('describes a cadence in a line', () => {
    expect(cadenceSummary(ses.cadence, ses.warmup)).toBe('2 / min, 60 / h, 400 / jour · lun. → ven., 8 h – 18 h · warm-up');
    expect(cadenceSummary(EMPTY_CADENCE, EMPTY_WARMUP)).toBe('Pas de limite propre');
    expect(hasCadence(EMPTY_CADENCE, EMPTY_WARMUP)).toBe(false);
  });

  it('lists non-consecutive days and all-day windows', () => {
    expect(windowSummary({ ...EMPTY_CADENCE, days: [3, 1] })).toBe('lun., mer.');
    expect(windowSummary({ ...EMPTY_CADENCE, from_hour: 9, to_hour: 12 })).toBe('tous les jours, 9 h – 12 h');
    expect(windowSummary(EMPTY_CADENCE)).toBe('');
  });

  it('names relays the way people read them', () => {
    expect(relayName({ name: 'email', pool: true })).toBe('Relais par défaut');
    expect(relayName({ name: 'email-sport-ses', pool: false })).toBe('sport-ses');
  });

  it('parses relay days as local dates', () => {
    expect(parseDay('2026-10-16')?.getDate()).toBe(16);
    expect(parseDay('16/10/2026')).toBeNull();
  });
});
