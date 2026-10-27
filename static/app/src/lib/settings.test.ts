import { describe, expect, it } from 'vitest';
import type { Settings } from '../api/types';
import { isMasked, settingsForSave } from './settings';
import { SMTP_PRESETS, applySmtpPreset, forSave, newSmtpServer, smtpErrors } from './smtp';

const base = {
  smtp: [{ ...newSmtpServer(), uuid: 'a', name: 'email-ovh', host: 'ssl0.ovh.net', username: 'x@y.fr', password: '••••••' }],
  'bounce.mailboxes': [{ host: 'imap', password: '••' }],
  'bounce.postmark': { password: '' },
  'security.captcha': { hcaptcha: { secret: '•••' } },
  'upload.s3.aws_secret_access_key': '••••',
} as unknown as Settings;

describe('settingsForSave', () => {
  it('empties masked secrets so that the server keeps them', () => {
    const r = settingsForSave(base);
    if (!('settings' in r)) throw new Error(r.error);
    expect(r.settings.smtp[0].password).toBe('');
    expect((r.settings['bounce.mailboxes'] as { password: string }[])[0].password).toBe('');
    expect((r.settings['security.captcha'] as { hcaptcha: { secret: string } }).hcaptcha.secret).toBe('');
    expect(r.settings['upload.s3.aws_secret_access_key']).toBe('');
    // The original isn't touched.
    expect(base.smtp[0].password).toBe('••••••');
  });

  it('keeps a new password and refuses a half-masked one', () => {
    const fresh = structuredClone(base);
    fresh.smtp[0].password = 'nouveau-mot-de-passe';
    const ok = settingsForSave(fresh);
    expect('settings' in ok && ok.settings.smtp[0].password).toBe('nouveau-mot-de-passe');

    fresh.smtp[0].password = '•••abc';
    expect(settingsForSave(fresh)).toEqual({ error: 'SMTP n°1' });
    expect(isMasked('')).toBe(true);
  });
});

describe('SMTP servers', () => {
  it('fills the provider settings from a preset', () => {
    const ovh = SMTP_PRESETS.find((p) => p.id === 'ovh')!;
    const s = applySmtpPreset(newSmtpServer(), ovh);
    expect(s).toMatchObject({ host: 'ssl0.ovh.net', port: 465, tls_type: 'TLS', auth_protocol: 'login', name: 'ovh' });
  });

  it('explains what is missing', () => {
    const s = { ...newSmtpServer(), name: 'Mon Serveur', host: '', username: '', idle_timeout: '15' };
    const e = smtpErrors(s, []);
    expect(Object.keys(e).sort()).toEqual(['host', 'idle_timeout', 'name', 'username']);
    const ok = { ...newSmtpServer(), uuid: 'b', name: 'ovh', host: 'ssl0.ovh.net', username: 'a@b.fr' };
    expect(smtpErrors(ok, [])).toEqual({});
    expect(smtpErrors(ok, [{ ...ok, uuid: 'c' }]).name).toBeTruthy();
  });

  it('only sends a password that was typed', () => {
    expect('password' in forSave({ ...newSmtpServer(), password: '' })).toBe(false);
    expect(forSave({ ...newSmtpServer(), password: 'abc' }).password).toBe('abc');
  });
});
