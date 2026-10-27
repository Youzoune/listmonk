// Personalisation variables. People type readable tokens such as {prénom};
// listmonk renders Go templates such as {{ .Subscriber.FirstName }}.

export interface Variable {
  token: string;
  label: string;
  template: string;
  sample: string;
}

export const VARIABLES: Variable[] = [
  { token: 'prénom', label: 'Prénom', template: '{{ .Subscriber.FirstName }}', sample: 'Camille' },
  { token: 'nom', label: 'Nom', template: '{{ .Subscriber.LastName }}', sample: 'Martin' },
  { token: 'email', label: 'E-mail', template: '{{ .Subscriber.Email }}', sample: 'camille.martin@example.com' },
  { token: 'organisation', label: 'Organisation', template: '{{ .Subscriber.Attribs.organisation | default "" }}', sample: 'AS Créteil Handball' },
  { token: 'ville', label: 'Ville', template: '{{ .Subscriber.Attribs.ville | default "" }}', sample: 'Créteil' },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Turns readable tokens into listmonk templates. Unknown {tokens} are left as they are.
export function toTemplate(text: string): string {
  return VARIABLES.reduce((t, v) => t.replace(new RegExp(`\\{${escape(v.token)}\\}`, 'g'), v.template), text);
}

// Turns the listmonk templates this app writes back into readable tokens.
// Accepts the spacing variants people write by hand: {{.Subscriber.FirstName}}.
export function fromTemplate(text: string): string {
  return VARIABLES.reduce((t, v) => {
    const inner = v.template.slice(2, -2).trim().replace(/\s*\|\s*/g, ' | ');
    const pattern = escape(inner).replace(/ \\\| /g, '\\s*\\|\\s*').replace(/ /g, '\\s+');
    return t.replace(new RegExp(`\\{\\{\\s*${pattern}\\s*\\}\\}`, 'g'), `{${v.token}}`);
  }, text);
}

// Renders a preview with each variable's sample value, or a contact's own values.
export function preview(text: string, values: Partial<Record<string, string>> = {}): string {
  return VARIABLES.reduce((t, v) => t.split(`{${v.token}}`).join(values[v.token] ?? v.sample), text);
}
