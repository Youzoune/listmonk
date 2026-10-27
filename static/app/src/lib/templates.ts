// E-mail templates: starters, the tags people can use, and the check the
// server makes on campaign templates (cmd/templates.go, validateTemplate).
import type { TemplateType } from '../api/types';

export const CONTENT_TAG = '{{ template "content" . }}';

const CONTENT_RE = /\{\{\s*template\s+"content"\s+\.\s*\}\}/;

export const hasContentTag = (body: string) => CONTENT_RE.test(body);

export const TEMPLATE_TYPES: Record<TemplateType, { label: string; hint: string }> = {
  campaign: { label: 'Campagne', hint: 'L’habillage des campagnes : en-tête, pied de page, mise en forme. Le texte de la campagne vient à la place de la balise de contenu.' },
  campaign_visual: { label: 'Campagne (éditeur visuel)', hint: 'Créé avec l’éditeur visuel de l’ancienne interface.' },
  tx: { label: 'Transactionnel', hint: 'Un e-mail envoyé un par un par une autre application (confirmation de commande, mot de passe…) via l’API /api/tx.' },
};

// The tags people use most, with what they print.
export const TEMPLATE_TAGS: { tag: string; what: string; types: TemplateType[] }[] = [
  { tag: CONTENT_TAG, what: 'Le contenu de la campagne. Obligatoire dans un modèle de campagne.', types: ['campaign'] },
  { tag: '{{ .Subscriber.Name }}', what: 'Le nom du contact.', types: ['campaign', 'tx'] },
  { tag: '{{ .Subscriber.Email }}', what: 'L’adresse e-mail du contact.', types: ['campaign', 'tx'] },
  { tag: '{{ .Subscriber.Attribs.ville }}', what: 'Un attribut du contact (ici « ville »).', types: ['campaign', 'tx'] },
  { tag: '{{ UnsubscribeURL }}', what: 'Le lien de désinscription. À mettre dans le pied de page.', types: ['campaign'] },
  { tag: '{{ ManageURL }}', what: 'Le lien de gestion des abonnements.', types: ['campaign'] },
  { tag: '{{ MessageURL }}', what: 'Le lien « voir dans le navigateur ».', types: ['campaign'] },
  { tag: '{{ TrackView }}', what: 'Le pixel qui compte les ouvertures.', types: ['campaign'] },
  { tag: '{{ .Tx.Data.commande }}', what: 'Une donnée envoyée par l’application (ici « commande »).', types: ['tx'] },
];

export const STARTERS: Record<'campaign' | 'tx', { subject: string; body: string }> = {
  campaign: {
    subject: '',
    body: `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; background: #f4f4f2; font-family: Helvetica, Arial, sans-serif; color: #1c1c1c; }
    .wrap { max-width: 620px; margin: 0 auto; padding: 24px 16px; }
    .card { background: #ffffff; border-radius: 10px; padding: 28px 24px; line-height: 1.6; }
    .footer { color: #6b6b6b; font-size: 13px; text-align: center; padding: 18px 8px; }
    .footer a { color: #6b6b6b; }
    img { max-width: 100%; height: auto; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      ${CONTENT_TAG}
    </div>
    <div class="footer">
      <p><a href="{{ MessageURL }}">Voir dans le navigateur</a> · <a href="{{ UnsubscribeURL }}">Se désinscrire</a></p>
    </div>
  </div>
  {{ TrackView }}
</body>
</html>
`,
  },
  tx: {
    subject: 'Bonjour {{ .Subscriber.Name }}',
    body: `<p>Bonjour {{ .Subscriber.Name }},</p>
<p>Votre commande {{ .Tx.Data.commande }} est confirmée.</p>
<p>À bientôt !</p>
`,
  },
};

// The reasons a template can't be saved.
export function templateErrors(t: { name: string; type: TemplateType; subject: string; body: string }) {
  const e: { name?: string; subject?: string; body?: string } = {};
  if (!t.name.trim()) e.name = 'Donnez un nom au modèle.';
  if (t.type === 'tx' && !t.subject.trim()) e.subject = 'Un modèle transactionnel a besoin d’un objet.';
  if (t.type === 'campaign' && !hasContentTag(t.body)) e.body = `Le modèle doit contenir ${CONTENT_TAG} à l’endroit où le texte de la campagne s’affiche.`;
  return e;
}
