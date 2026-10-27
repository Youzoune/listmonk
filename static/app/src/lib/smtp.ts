// SMTP servers as the settings screen edits them: provider presets, a blank
// server and the checks the server would otherwise refuse.
import type { SmtpServer } from '../api/types';
import { EMPTY_CADENCE, EMPTY_WARMUP } from './relays';

export interface SmtpPreset {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: SmtpServer['tls_type'];
  auth: SmtpServer['auth_protocol'];
  // What to put in the username and password fields, in plain words.
  credentials: string;
  // The matching relay preset (lib/presets.ts), for the cadence.
  relayPreset?: string;
}

export const SMTP_PRESETS: SmtpPreset[] = [
  {
    id: 'ovh', name: 'OVHcloud (MX Plan)', host: 'ssl0.ovh.net', port: 465, tls: 'TLS', auth: 'login',
    credentials: 'L’adresse e-mail complète et son mot de passe.', relayPreset: 'ovh',
  },
  {
    id: 'ovh-pro', name: 'OVHcloud (Email Pro)', host: 'pro1.mail.ovh.net', port: 587, tls: 'STARTTLS', auth: 'login',
    credentials: 'L’adresse e-mail complète et son mot de passe.', relayPreset: 'ovh',
  },
  {
    id: 'google', name: 'Google Workspace / Gmail', host: 'smtp.gmail.com', port: 587, tls: 'STARTTLS', auth: 'login',
    credentials: 'L’adresse e-mail et un « mot de passe d’application » créé dans le compte Google (pas le mot de passe habituel).',
    relayPreset: 'google-workspace',
  },
  {
    id: 'microsoft', name: 'Microsoft 365 / Outlook', host: 'smtp.office365.com', port: 587, tls: 'STARTTLS', auth: 'login',
    credentials: 'L’adresse e-mail et son mot de passe. L’envoi SMTP doit être autorisé pour ce compte dans l’administration Microsoft 365.',
    relayPreset: 'microsoft-365',
  },
  {
    id: 'brevo', name: 'Brevo', host: 'smtp-relay.brevo.com', port: 587, tls: 'STARTTLS', auth: 'login',
    credentials: 'L’identifiant SMTP et la clé SMTP, dans Brevo › SMTP & API.', relayPreset: 'brevo-free',
  },
  {
    id: 'mailjet', name: 'Mailjet', host: 'in-v3.mailjet.com', port: 587, tls: 'STARTTLS', auth: 'login',
    credentials: 'La clé API (identifiant) et la clé secrète (mot de passe).',
  },
  {
    id: 'ses', name: 'Amazon SES (Paris)', host: 'email-smtp.eu-west-3.amazonaws.com', port: 587, tls: 'STARTTLS', auth: 'login',
    credentials: 'Les identifiants SMTP créés dans la console SES (pas les clés IAM). Changez la région dans l’hôte si besoin.',
    relayPreset: 'ses-sandbox',
  },
];

export function newSmtpServer(): SmtpServer {
  return {
    _new: true,
    uuid: '', name: '', enabled: true, host: '', hello_hostname: '', port: 587, auth_protocol: 'login',
    username: '', password: '', email_headers: [], max_conns: 10, max_msg_retries: 2, msg_retry_delay: '5s',
    idle_timeout: '15s', wait_timeout: '5s', tls_type: 'STARTTLS', tls_skip_verify: false, from_addresses: [],
    exclude_from_default: false, project_id: 0, cadence: { ...EMPTY_CADENCE }, warmup: { ...EMPTY_WARMUP },
  };
}

export function applySmtpPreset(s: SmtpServer, p: SmtpPreset): SmtpServer {
  return { ...s, host: p.host, port: p.port, tls_type: p.tls, auth_protocol: p.auth, name: s.name || p.id };
}

const NAME_RE = /^[a-z0-9-]*$/;
const DURATION_RE = /^\d+(ms|s|m|h)$/;

// The reasons a server can't be saved, by field.
export function smtpErrors(s: SmtpServer, others: SmtpServer[]): Partial<Record<keyof SmtpServer, string>> {
  const e: Partial<Record<keyof SmtpServer, string>> = {};
  if (!s.host.trim()) e.host = 'Indiquez l’adresse du serveur, par exemple ssl0.ovh.net.';
  if (!(s.port > 0 && s.port < 65536)) e.port = 'Un port entre 1 et 65535 (souvent 587 ou 465).';
  // Saved names carry the messenger prefix ("email-ovh"); typed ones don't.
  const bare = (n: string) => n.replace(/^email-/, '');
  if (!NAME_RE.test(bare(s.name))) e.name = 'Minuscules, chiffres et tirets seulement.';
  else if (s.name && others.some((o) => o !== s && (o.uuid !== s.uuid || !s.uuid) && bare(o.name) === bare(s.name))) e.name = 'Un autre serveur porte déjà ce nom.';
  if (s.project_id !== 0 && !s.name) e.name = 'Un serveur réservé à un projet doit avoir un nom.';
  if (s.auth_protocol !== 'none' && !s.username.trim()) e.username = 'Indiquez l’identifiant de connexion.';
  if (!(s.max_conns >= 1)) e.max_conns = 'Au moins 1.';
  for (const k of ['idle_timeout', 'wait_timeout', 'msg_retry_delay'] as const) {
    if (!DURATION_RE.test(s[k])) e[k] = 'Une durée comme 5s, 500ms ou 1m.';
  }
  return e;
}

// The settings PUT keeps a saved password when none is sent: never send the
// masked placeholder back.
export function forSave(s: SmtpServer): SmtpServer {
  const { password, ...rest } = s;
  return password ? { ...rest, password } : { ...rest };
}

// A free relay name from a provider id: "ovh", then "ovh-2", "ovh-3"…
export function freeRelayName(base: string, servers: Pick<SmtpServer, 'name'>[]): string {
  const taken = new Set(servers.map((s) => s.name.replace(/^email-/, '')));
  const clean = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'relais';
  if (!taken.has(clean)) return clean;
  for (let i = 2; ; i++) if (!taken.has(`${clean}-${i}`)) return `${clean}-${i}`;
}
