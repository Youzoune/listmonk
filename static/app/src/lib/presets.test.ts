import { describe, expect, it } from 'vitest';
import { EMPTY_CADENCE, EMPTY_WARMUP, cadenceSummary, toCadence } from './relays';
import { PRESETS, applyPreset, matchingPreset } from './presets';
import { dailyLimit } from './sending';

const byId = (id: string) => PRESETS.find((p) => p.id === id)!;

describe('presets', () => {
  it('pass the server validation rules', () => {
    for (const p of PRESETS) {
      const { cadence: c, warmup: w } = applyPreset(p, EMPTY_CADENCE, { ...EMPTY_WARMUP, since: '2026-10-27' });
      expect(c.per_minute >= 0 && c.per_hour >= 0 && c.per_day >= 0, p.id).toBe(true);
      expect(c.to_hour === 0 || c.to_hour > c.from_hour, p.id).toBe(true);
      if (w.enabled) {
        expect(w.start, p.id).toBeGreaterThanOrEqual(1);
        expect(w.cap, p.id).toBeGreaterThanOrEqual(w.start);
      }
    }
  });

  it('stay under the provider limits', () => {
    const ovh = applyPreset(byId('ovh'), EMPTY_CADENCE, EMPTY_WARMUP).cadence;
    expect(ovh.per_hour).toBeLessThan(200);
    expect(ovh.per_minute * 60).toBeLessThan(200);
    const google = applyPreset(byId('google-workspace'), EMPTY_CADENCE, EMPTY_WARMUP);
    expect(dailyLimit(toCadence(google.cadence, { ...google.warmup, since: '2026-01-01' }), new Date(2026, 9, 27))).toBeLessThan(2000);
    expect(applyPreset(byId('microsoft-365'), EMPTY_CADENCE, EMPTY_WARMUP).cadence.per_minute).toBeLessThan(30);
  });

  it('keep the relay timezone and warm-up start date', () => {
    const { cadence, warmup } = applyPreset(byId('new-domain'), { ...EMPTY_CADENCE, timezone: 'Europe/Brussels' }, { ...EMPTY_WARMUP, since: '2026-10-01' });
    expect(cadence.timezone).toBe('Europe/Brussels');
    expect(warmup.since).toBe('2026-10-01');
    expect(cadenceSummary(cadence, warmup)).toBe('5 / min, 150 / h · lun. → ven., 9 h – 18 h · warm-up');
  });

  it('recognise the preset a relay uses', () => {
    const { cadence, warmup } = applyPreset(byId('brevo-free'), EMPTY_CADENCE, EMPTY_WARMUP);
    expect(matchingPreset(cadence, warmup)?.id).toBe('brevo-free');
    expect(matchingPreset({ ...cadence, per_day: 250 }, warmup)).toBeUndefined();
    expect(matchingPreset(EMPTY_CADENCE, EMPTY_WARMUP)).toBeUndefined();
  });
});
