// GET /api/settings masks every secret with "•". PUT keeps the saved secret
// when it receives an empty one, so masked secrets must be emptied before
// saving, and a secret partly made of "•" is a typo to refuse (the same rules
// as the legacy admin, static/admin/assets/js/views/settings.js).
import type { Settings } from '../api/types';

const MASK = '•';

export const isMasked = (v: unknown) => typeof v === 'string' && (v === '' || [...v].every((c) => c === MASK));
const hasMask = (v: unknown) => typeof v === 'string' && v.includes(MASK);

type Obj = Record<string, unknown>;

// [path to an object or array of objects, secret key, label]
const SECRETS: [string, string, string][] = [
  ['smtp', 'password', 'SMTP'],
  ['bounce.mailboxes', 'password', 'boîte de rebonds'],
  ['messengers', 'password', 'messager'],
  ['bounce.azure', 'shared_secret', 'Azure'],
  ['bounce.postmark', 'password', 'Postmark'],
  ['bounce.forwardemail', 'key', 'Forward Email'],
  ['bounce.lettermint', 'key', 'Lettermint'],
  ['security.oidc', 'client_secret', 'OIDC'],
];
const TOP_SECRETS: [string, string][] = [
  ['upload.s3.aws_secret_access_key', 'S3'],
  ['bounce.sendgrid_key', 'SendGrid'],
];

// Returns the settings ready to be saved, or the label of a secret that
// still contains mask characters.
export function settingsForSave(settings: Settings): { settings: Settings } | { error: string } {
  const out = structuredClone(settings) as Settings & Obj;
  out.smtp = out.smtp.map(({ _new: _, ...s }) => s);
  const clean = (o: Obj | undefined, k: string, label: string): string | null => {
    if (!o || !(k in o)) return null;
    if (isMasked(o[k])) o[k] = '';
    else if (hasMask(o[k])) return label;
    return null;
  };

  for (const [path, k, label] of SECRETS) {
    const v = out[path];
    const items = Array.isArray(v) ? v as Obj[] : v && typeof v === 'object' ? [v as Obj] : [];
    for (const [i, item] of items.entries()) {
      const bad = clean(item, k, Array.isArray(v) ? `${label} n°${i + 1}` : label);
      if (bad) return { error: bad };
    }
  }
  const captcha = out['security.captcha'] as { hcaptcha?: Obj } | undefined;
  const bad = clean(captcha?.hcaptcha, 'secret', 'hCaptcha');
  if (bad) return { error: bad };
  for (const [k, label] of TOP_SECRETS) {
    const b = clean(out, k, label);
    if (b) return { error: b };
  }

  return { settings: out };
}

// The settings as the screens edit them: the secrets they show as password
// fields start empty ("leave empty to keep") instead of masked.
export function forEditing(settings: Settings): Settings {
  const out = structuredClone(settings) as Settings & Obj;
  out.smtp = out.smtp.map((s) => ({ ...s, password: '' }));
  if (isMasked(out['upload.s3.aws_secret_access_key'])) out['upload.s3.aws_secret_access_key'] = '';
  const captcha = out['security.captcha'] as { hcaptcha?: Obj } | undefined;
  if (captcha?.hcaptcha && isMasked(captcha.hcaptcha.secret)) captcha.hcaptcha.secret = '';
  return out;
}
