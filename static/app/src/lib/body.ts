import { toTemplate } from './variables';

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
