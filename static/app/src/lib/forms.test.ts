import { describe, expect, it } from 'vitest';
import { signupFormHTML } from './forms';

describe('signup form', () => {
  it('posts to the project address with the chosen lists', () => {
    const h = signupFormHTML({
      root: 'https://sport.mailing.youzoune.com/',
      lists: [{ uuid: 'abcdef12-0000', name: 'Gazette "club"', description: 'Chaque mois' }],
      redirect: 'https://club.fr/merci',
    });
    expect(h).toContain('action="https://sport.mailing.youzoune.com/subscription/form"');
    expect(h).toContain('value="abcdef12-0000"');
    expect(h).toContain('Gazette &quot;club&quot;');
    expect(h).toContain('name="next" value="https://club.fr/merci"');
    expect(h).toContain('name="nonce"');
  });

  it('adds the captcha widget', () => {
    expect(signupFormHTML({ root: 'https://x.fr', lists: [], captcha: { provider: 'altcha' } })).toContain('altcha-widget challenge="https://x.fr/api/public/captcha/altcha"');
    expect(signupFormHTML({ root: 'https://x.fr', lists: [], captcha: { provider: 'hcaptcha', key: 'k1' } })).toContain('data-sitekey="k1"');
  });
});
