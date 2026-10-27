// Ready-made relay settings: the limits of common SMTP providers, and sending
// profiles for people who don't know where to start. Provider figures are the
// published limits as of October 2026, kept about 10 % below so that the
// provider never has to refuse a message.
import type { RelayCadence, RelayWarmup } from '../api/types';
import { EMPTY_CADENCE, EMPTY_WARMUP, hasCadence } from './relays';

export type PresetKind = 'profile' | 'provider';

export interface Preset {
  id: string;
  kind: PresetKind;
  name: string;
  // One line on when to choose it.
  when: string;
  // What the provider enforces, in plain words (providers only).
  limits?: string;
  cadence: Partial<RelayCadence>;
  warmup: Partial<RelayWarmup>;
  source?: string;
}

const WEEKDAYS = [1, 2, 3, 4, 5];

export const PRESETS: Preset[] = [
  {
    id: 'new-domain',
    kind: 'profile',
    name: 'Nouveau domaine ou nouveau serveur',
    when: 'Vous n’avez jamais envoyé de newsletter depuis ce domaine ou ce serveur. Le plus prudent.',
    cadence: { per_minute: 5, per_hour: 150, per_day: 0, days: WEEKDAYS, from_hour: 9, to_hour: 18 },
    warmup: { enabled: true, start: 50, growth: 20, cap: 2000 },
  },
  {
    id: 'known-domain',
    kind: 'profile',
    name: 'Domaine déjà utilisé, liste propre',
    when: 'Le domaine envoie déjà des e-mails sans souci et vos abonnés ont tous demandé à recevoir vos messages.',
    cadence: { per_minute: 20, per_hour: 1000, per_day: 0, days: [], from_hour: 8, to_hour: 20 },
    warmup: { enabled: true, start: 500, growth: 30, cap: 10000 },
  },
  {
    id: 'old-list',
    kind: 'profile',
    name: 'Vieille liste à relancer',
    when: 'Une liste qui n’a rien reçu depuis plus de six mois : beaucoup d’adresses ont pu disparaître.',
    cadence: { per_minute: 3, per_hour: 100, per_day: 0, days: WEEKDAYS, from_hour: 9, to_hour: 17 },
    warmup: { enabled: true, start: 30, growth: 15, cap: 1000 },
  },
  {
    id: 'notifications',
    kind: 'profile',
    name: 'Notifications et e-mails transactionnels',
    when: 'Un relais réservé aux confirmations d’inscription et aux e-mails attendus par la personne : pas de frein.',
    cadence: { per_minute: 0, per_hour: 0, per_day: 0, days: [], from_hour: 0, to_hour: 0 },
    warmup: { enabled: false },
  },
  {
    id: 'ovh',
    kind: 'provider',
    name: 'OVHcloud (MX Plan, Email Pro)',
    when: 'Une adresse e-mail d’un hébergement OVHcloud.',
    limits: '200 e-mails par heure et par adresse. Au-delà, OVHcloud bloque l’envoi pendant une heure.',
    cadence: { per_minute: 3, per_hour: 180, per_day: 0, days: [], from_hour: 0, to_hour: 0 },
    warmup: { enabled: false },
    source: 'https://community.ovhcloud.com/t/limite-envoi-de-mail-types-de-comptes/13253',
  },
  {
    id: 'google-workspace',
    kind: 'provider',
    name: 'Google Workspace',
    when: 'Une adresse professionnelle hébergée chez Google (Gmail avec votre domaine).',
    limits: '2 000 e-mails par jour et par compte (500 pendant l’essai gratuit). Au-delà, le compte ne peut plus envoyer pendant 24 h.',
    cadence: { per_minute: 10, per_hour: 0, per_day: 1800, days: [], from_hour: 0, to_hour: 0 },
    warmup: { enabled: true, start: 100, growth: 25, cap: 1800 },
    source: 'https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace',
  },
  {
    id: 'gmail',
    kind: 'provider',
    name: 'Gmail personnel',
    when: 'Une adresse @gmail.com. À éviter pour une newsletter : prévu pour un usage personnel.',
    limits: 'Environ 500 destinataires par jour.',
    cadence: { per_minute: 5, per_hour: 0, per_day: 450, days: [], from_hour: 0, to_hour: 0 },
    warmup: { enabled: false },
  },
  {
    id: 'microsoft-365',
    kind: 'provider',
    name: 'Microsoft 365 (Outlook, Exchange Online)',
    when: 'Une adresse professionnelle hébergée chez Microsoft.',
    limits: '30 e-mails par minute en SMTP et 10 000 destinataires par jour.',
    cadence: { per_minute: 25, per_hour: 0, per_day: 9000, days: [], from_hour: 0, to_hour: 0 },
    warmup: { enabled: true, start: 200, growth: 25, cap: 9000 },
  },
  {
    id: 'brevo-free',
    kind: 'provider',
    name: 'Brevo, offre gratuite',
    when: 'Un compte Brevo (ex-Sendinblue) sans abonnement.',
    limits: '300 e-mails par jour. Le compteur repart à zéro chaque jour.',
    cadence: { per_minute: 0, per_hour: 0, per_day: 300, days: [], from_hour: 0, to_hour: 0 },
    warmup: { enabled: false },
    source: 'https://help.brevo.com/hc/en-us/articles/208580669',
  },
  {
    id: 'ses-sandbox',
    kind: 'provider',
    name: 'Amazon SES, compte en bac à sable',
    when: 'Un compte Amazon SES pas encore sorti du « sandbox ».',
    limits: '200 e-mails par 24 h, un par seconde, et seulement vers des adresses vérifiées.',
    cadence: { per_minute: 60, per_hour: 0, per_day: 200, days: [], from_hour: 0, to_hour: 0 },
    warmup: { enabled: false },
  },
];

// The relay settings once a preset is applied. The timezone and the warm-up
// start date stay the relay's own: a preset doesn't know them.
export function applyPreset(p: Preset, cadence: RelayCadence, warmup: RelayWarmup): { cadence: RelayCadence; warmup: RelayWarmup } {
  return {
    cadence: { ...EMPTY_CADENCE, ...p.cadence, timezone: cadence.timezone || EMPTY_CADENCE.timezone },
    warmup: { ...EMPTY_WARMUP, ...p.warmup, since: warmup.since },
  };
}

// The preset the current settings match, if any. A relay without any limit
// isn't said to follow the notifications profile: it's simply not set up.
export function matchingPreset(cadence: RelayCadence, warmup: RelayWarmup): Preset | undefined {
  if (!hasCadence(cadence, warmup)) return undefined;
  const same = (a?: number[] | null, b?: number[] | null) =>
    [...(a ?? [])].sort().join() === [...(b ?? [])].sort().join();
  return PRESETS.find((p) => {
    const c = applyPreset(p, cadence, warmup);
    const w = c.warmup;
    return c.cadence.per_minute === cadence.per_minute && c.cadence.per_hour === cadence.per_hour &&
      c.cadence.per_day === cadence.per_day && same(c.cadence.days, cadence.days) &&
      c.cadence.from_hour === cadence.from_hour && c.cadence.to_hour === cadence.to_hour &&
      w.enabled === warmup.enabled && (!w.enabled || (w.start === warmup.start && w.growth === warmup.growth && w.cap === warmup.cap));
  });
}
