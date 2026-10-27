// Relays as the screens need them: the API's cadence turned into the maths of
// lib/sending.ts, and readable summaries.
import type { Relay, RelayCadence, RelayWarmup } from '../api/types';
import type { Cadence } from './sending';

export const DAY_NAMES = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
// Monday first, as people read a week in France.
export const WEEK = [1, 2, 3, 4, 5, 6, 0];

export const EMPTY_CADENCE: RelayCadence = {
  per_minute: 0, per_hour: 0, per_day: 0, days: [], from_hour: 0, to_hour: 0, timezone: 'Europe/Paris',
};

export const EMPTY_WARMUP: RelayWarmup = { enabled: false, start: 30, growth: 15, cap: 500, since: '' };

const unlimited = (n: number) => (n > 0 ? n : Number.POSITIVE_INFINITY);

// Parses YYYY-MM-DD as a local date (the relay's day, not UTC midnight).
export function parseDay(day: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// The relay's cadence in the shape lib/sending.ts expects. Zero means no limit.
export function toCadence(c: RelayCadence, w: RelayWarmup): Cadence {
  const days = c.days && c.days.length > 0 ? c.days : [0, 1, 2, 3, 4, 5, 6];
  const allDay = c.from_hour === 0 && (c.to_hour === 0 || c.to_hour >= 24);
  return {
    perMinute: unlimited(c.per_minute),
    perHour: unlimited(c.per_hour),
    perDay: unlimited(c.per_day),
    days,
    fromHour: allDay ? 0 : c.from_hour,
    toHour: allDay ? 24 : c.to_hour,
    warmup: {
      enabled: w.enabled,
      start: w.start,
      growth: w.growth,
      cap: w.cap,
      since: parseDay(w.since) ?? new Date(),
    },
  };
}

export function hasCadence(c: RelayCadence, w: RelayWarmup): boolean {
  return c.per_minute > 0 || c.per_hour > 0 || c.per_day > 0 || (c.days?.length ?? 0) > 0 ||
    !(c.from_hour === 0 && (c.to_hour === 0 || c.to_hour >= 24)) || w.enabled;
}

// "email" is listmonk's default pool; named SMTP servers are called "email-<name>".
// A server saved without a name goes by its address.
export function relayName(r: Pick<Relay, 'name' | 'pool'> & { host?: string }): string {
  if (r.pool || r.name === 'email') return 'Relais par défaut';
  const name = r.name.replace(/^email-/, '');
  return name || (r.host ? `Serveur ${r.host}` : 'Serveur sans nom');
}

// "40 / h, 250 / jour · lun. → ven., 9 h – 17 h"
export function cadenceSummary(c: RelayCadence, w: RelayWarmup): string {
  if (!hasCadence(c, w)) return 'Pas de limite propre';
  const rates = [
    c.per_minute > 0 && `${c.per_minute} / min`,
    c.per_hour > 0 && `${c.per_hour} / h`,
    c.per_day > 0 && `${c.per_day} / jour`,
  ].filter(Boolean).join(', ');
  return [rates, windowSummary(c), w.enabled && 'warm-up'].filter(Boolean).join(' · ');
}

export function windowSummary(c: RelayCadence): string {
  const days = c.days && c.days.length > 0 && c.days.length < 7 ? [...c.days].sort((a, b) => WEEK.indexOf(a) - WEEK.indexOf(b)) : null;
  const allDay = c.from_hour === 0 && (c.to_hour === 0 || c.to_hour >= 24);
  if (!days && allDay) return '';

  let d = 'tous les jours';
  if (days) {
    const consecutive = days.every((x, i) => i === 0 || WEEK.indexOf(x) === WEEK.indexOf(days[i - 1]) + 1);
    d = consecutive && days.length > 2 ? `${DAY_NAMES[days[0]]} → ${DAY_NAMES[days[days.length - 1]]}` : days.map((x) => DAY_NAMES[x]).join(', ');
  }
  return allDay ? d : `${d}, ${c.from_hour} h – ${c.to_hour || 24} h`;
}
