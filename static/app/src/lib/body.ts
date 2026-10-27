import { fromTemplate, toTemplate } from './variables';

const escapeHTML = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Turns the plain text people write into the rich-text HTML listmonk sends:
// blank lines split paragraphs, single line breaks become <br>, and readable
// variables become listmonk templates.
export function textToCampaignHTML(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${toTemplate(escapeHTML(p.trim())).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

const unescapeHTML = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// The reverse of textToCampaignHTML, for editing a campaign written in this
// app as text again. Returns null when the HTML has more than paragraphs and
// line breaks (written elsewhere, or with formatting): it's then edited as HTML.
export function campaignHTMLToText(html: string): string | null {
  const src = html.trim();
  if (!src) return '';
  const paragraphs = src.split(/\s*<\/p>\s*/).filter(Boolean);
  const out: string[] = [];
  for (const p of paragraphs) {
    const m = /^<p>([\s\S]*)$/.exec(p.trim());
    if (!m) return null;
    const inner = m[1].replace(/<br\s*\/?>/g, '\n');
    if (/<[a-z/!]/i.test(inner)) return null;
    out.push(unescapeHTML(fromTemplate(inner)));
  }
  return out.join('\n\n');
}
