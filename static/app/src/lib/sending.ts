// Cadence and warm-up maths, ported from the mock-up. The relay settings they
// read (per-relay rates, sending window, warm-up) arrive in the backend with lot 4.

const DAY_MS = 24 * 3600 * 1000;

export interface Warmup {
  enabled: boolean;
  start: number;
  growth: number; // percent per day
  cap: number;
  since: Date;
}

export interface Cadence {
  perMinute: number;
  perHour: number;
  perDay: number;
  days: number[]; // 0 = Sunday
  fromHour: number;
  toHour: number;
  warmup: Warmup;
}

// Day number of the warm-up (1 on the day the relay went live).
export function warmupDay(c: Cadence, date: Date) {
  const s = c.warmup.since;
  const d0 = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((d1.getTime() - d0.getTime()) / DAY_MS) + 1;
}

// Ceiling for a day: start × (1 + growth)^(day − 1), capped.
export function warmupCap(w: Warmup, day: number) {
  if (day < 1) return 0;
  return Math.min(w.cap, Math.round(w.start * Math.pow(1 + w.growth / 100, day - 1)));
}

export function dailyLimit(c: Cadence, date: Date) {
  if (!c.warmup.enabled) return c.perDay;
  return Math.min(c.perDay, warmupCap(c.warmup, warmupDay(c, date)));
}

// First day on which the warm-up reaches its ceiling, or null if it never ramps.
export function warmupDoneDay(w: Warmup) {
  if (w.start <= 0 || w.growth <= 0) return null;
  if (w.start >= w.cap) return 1;
  return Math.ceil(Math.log(w.cap / w.start) / Math.log(1 + w.growth / 100)) + 1;
}

export function hourlyRate(c: Cadence) {
  return Math.min(c.perHour, c.perMinute * 60);
}

// Simulates sending `count` messages hour by hour from `start`, honouring the
// sending window, the hourly rate and the daily limit. `sentToday` is what the
// relay already sent on the start day.
export function estimateEnd(c: Cadence, count: number, start: Date, sentToday = 0): { end: Date | null; days: number } {
  if (count <= 0) return { end: start, days: 0 };
  const rate = hourlyRate(c);
  if (rate <= 0) return { end: null, days: 0 };

  let left = count;
  let t = new Date(start);
  t.setMinutes(0, 0, 0);
  let day = t.toDateString();
  let used = sentToday;
  const days = new Set<string>();

  for (let i = 0; i < 24 * 120 && left > 0; i++) {
    if (t.toDateString() !== day) {
      day = t.toDateString();
      used = 0;
    }
    const open = c.days.includes(t.getDay()) && t.getHours() >= c.fromHour && t.getHours() < c.toHour;
    if (open) {
      const n = Math.min(rate, Math.max(0, dailyLimit(c, t) - used), left);
      if (n > 0) {
        left -= n;
        used += n;
        days.add(day);
        if (left === 0) return { end: new Date(t.getTime() + Math.ceil((n / rate) * 60) * 60_000), days: days.size };
      }
    }
    t = new Date(t.getTime() + 3600_000);
  }
  return { end: null, days: days.size };
}
