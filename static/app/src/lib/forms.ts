// The HTML signup form to paste on a website, like the legacy admin's form
// generator, posting to the project's own public address.

export interface FormList { uuid: string; name: string; description: string }

export interface SignupFormOpts {
  // The project's public root (its subdomain or custom domain).
  root: string;
  lists: FormList[];
  // Where to send people after signing up; must be a trusted URL in the settings.
  redirect?: string;
  captcha?: { provider: 'altcha' | 'hcaptcha'; key?: string } | null;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function signupFormHTML({ root, lists, redirect, captcha }: SignupFormOpts): string {
  const r = root.replace(/\/+$/, '');
  let h = `<form method="post" action="${esc(r)}/subscription/form" class="relais-form">\n`
    + '  <input type="hidden" name="nonce" />\n';
  if (redirect) h += `  <input type="hidden" name="next" value="${esc(redirect)}" />\n`;
  h += '  <p><input type="email" name="email" required placeholder="Votre e-mail" /></p>\n'
    + '  <p><input type="text" name="name" placeholder="Votre nom" /></p>\n';
  for (const l of lists) {
    const id = `l-${l.uuid.slice(0, 8)}`;
    h += `  <p>\n    <input id="${id}" type="checkbox" name="l" checked value="${esc(l.uuid)}" />\n    <label for="${id}">${esc(l.name)}</label>\n`;
    if (l.description) h += `    <br /><small>${esc(l.description)}</small>\n`;
    h += '  </p>\n';
  }
  if (captcha?.provider === 'altcha') {
    h += `  <altcha-widget challenge="${esc(r)}/api/public/captcha/altcha"></altcha-widget>\n`
      + `  <script type="module" src="${esc(r)}/public/static/altcha.umd.js" async defer></script>\n`;
  } else if (captcha?.provider === 'hcaptcha' && captcha.key) {
    h += `  <div class="h-captcha" data-sitekey="${esc(captcha.key)}"></div>\n`
      + '  <script src="https://js.hcaptcha.com/1/api.js" async defer></script>\n';
  }
  return `${h}  <p><button type="submit">S’inscrire</button></p>\n</form>\n`;
}
