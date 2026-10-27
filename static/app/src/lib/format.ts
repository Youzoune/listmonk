const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
const numFmt = new Intl.NumberFormat('fr-FR');

export const num = (n: number) => numFmt.format(n);

export function date(s: string | null | undefined) {
  return s ? dateFmt.format(new Date(s)) : '—';
}

export function dateTime(s: string | null | undefined) {
  return s ? dateTimeFmt.format(new Date(s)) : '—';
}

export function percent(part: number, total: number) {
  if (total <= 0) return '—';
  return `${Math.round((part / total) * 100)} %`;
}

// "Ahmed de WeSportive <ahmed@wesportive.fr>" → "Ahmed de WeSportive".
export function senderName(from: string) {
  const m = from.match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/);
  return m ? m[1] : from;
}

// listmonk names the default messenger "email" and each named SMTP after its name.
export function relayLabel(messenger: string) {
  return messenger === 'email' ? 'Relais par défaut' : messenger.replace(/^email-/, '');
}

export function initials(name: string) {
  return name.split(/[\s—-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

// "1 brouillon", "3 brouillons". `plural` defaults to the singular plus "s".
export function count(n: number, singular: string, plural = `${singular}s`) {
  return `${num(n)} ${n > 1 ? plural : singular}`;
}
