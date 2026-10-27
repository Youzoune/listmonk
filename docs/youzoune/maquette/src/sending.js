// Cadence and warm-up maths shared by the screens.

const DAY_MS = 24 * 3600 * 1000;

// Day number of the warm-up (1 on the day the relay went live).
export function warmupDay(relay, date) {
  const d0 = new Date(relay.warmup.since.getFullYear(), relay.warmup.since.getMonth(), relay.warmup.since.getDate());
  const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((d1 - d0) / DAY_MS) + 1;
}

// Warm-up ceiling for a given day number: start × (1 + growth)^(day − 1), capped.
export function warmupCap(w, day) {
  if (day < 1) return 0;
  return Math.min(w.cap, Math.round(w.start * Math.pow(1 + w.growth / 100, day - 1)));
}

// Effective daily limit of a relay on a date: its daily limit, lowered by the warm-up.
export function dailyLimit(relay, date) {
  if (!relay.warmup.enabled) return relay.perDay;
  return Math.min(relay.perDay, warmupCap(relay.warmup, warmupDay(relay, date)));
}

// Day on which the warm-up reaches its ceiling.
export function warmupDoneDay(w) {
  if (w.start <= 0 || w.growth <= 0) return null;
  return Math.ceil(Math.log(w.cap / w.start) / Math.log(1 + w.growth / 100)) + 1;
}

// Hourly throughput, bounded by the per-minute rate.
export function hourlyRate(relay) {
  return Math.min(relay.perHour, relay.perMinute * 60);
}

// Simulates sending `count` messages hour by hour from `start`, honouring the
// relay's sending window, hourly rate and daily limit (warm-up included).
// `sentToday` is what the relay already sent on the start day.
export function estimateEnd(relay, count, start, sentToday = 0) {
  if (count <= 0) return { end: start, days: 0 };
  let left = count;
  let t = new Date(start);
  t.setMinutes(0, 0, 0);
  let day = t.toDateString();
  let usedToday = sentToday;
  const rate = hourlyRate(relay);
  let sendingDays = new Set();

  for (let i = 0; i < 24 * 120 && left > 0; i++) {
    if (t.toDateString() !== day) {
      day = t.toDateString();
      usedToday = 0;
    }
    const open = relay.days.includes(t.getDay()) && t.getHours() >= relay.fromHour && t.getHours() < relay.toHour;
    if (open) {
      const room = Math.max(0, dailyLimit(relay, t) - usedToday);
      const n = Math.min(rate, room, left);
      if (n > 0) {
        left -= n;
        usedToday += n;
        sendingDays.add(day);
        if (left === 0) {
          const end = new Date(t.getTime() + Math.ceil((n / rate) * 60) * 60000);
          return { end, days: sendingDays.size };
        }
      }
    }
    t = new Date(t.getTime() + 3600 * 1000);
  }
  return { end: null, days: sendingDays.size };
}

const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function formatEnd(date) {
  if (!date) return 'plus de 4 mois';
  const h = date.getHours();
  const m = date.getMinutes();
  return `${fmtDay.format(date)} vers ${h} h${m ? ' ' + String(m).padStart(2, '0') : ''}`;
}

export function windowLabel(relay, dayLabels) {
  if (relay.days.length === 7 && relay.fromHour === 0 && relay.toHour === 24) return 'tous les jours, 24 h/24';
  const sorted = [...relay.days].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const names = sorted.map((d) => dayLabels[d]);
  const days = names.length > 2 ? `${names[0]} → ${names[names.length - 1]}` : names.join(', ');
  return `${days}, ${relay.fromHour} h – ${relay.toHour} h`;
}
