import { fromTemplate, toTemplate } from './variables';

const escapeHTML = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Turns the text people write into the rich-text HTML listmonk sends:
// blank lines split paragraphs, single line breaks become <br>, and readable
// variables become listmonk templates. A little formatting is understood:
// **gras**, *italique*, [texte](https://lien), ![image](https://adresse),
// "## " for a heading and "- " for list items.
export function textToCampaignHTML(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.trim().split('\n');
      if (lines.every((l) => /^- /.test(l))) return `<ul>${lines.map((l) => `<li>${inline(l.slice(2).trim())}</li>`).join('')}</ul>`;
      if (lines.length === 1 && /^## /.test(lines[0])) return `<h2>${inline(lines[0].slice(3).trim())}</h2>`;
      return `<p>${lines.map((l) => inline(l)).join('<br>')}</p>`;
    })
    .join('\n');
}

const URL_RE = String.raw`((?:https?:\/\/|mailto:)[^\s)"<>]+)`;

function inline(s: string): string {
  return toTemplate(escapeHTML(s))
    .replace(new RegExp(String.raw`!\[([^\]]*)\]\(` + URL_RE + String.raw`\)`, 'g'), '<img src="$2" alt="$1">')
    .replace(new RegExp(String.raw`\[([^\]]+)\]\(` + URL_RE + String.raw`\)`, 'g'), '<a href="$2">$1</a>')
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
}

const unescapeHTML = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

// The HTML of one block back to text, or null if it has other markup.
function inlineToText(html: string): string | null {
  const t = fromTemplate(html)
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<img src="([^"]*)" alt="([^"]*)"\s*\/?>/g, '![$2]($1)')
    .replace(/<a href="([^"]*)">([^<]*)<\/a>/g, '[$2]($1)')
    .replace(/<strong>([^<]*)<\/strong>/g, '**$1**')
    .replace(/<em>([^<]*)<\/em>/g, '*$1*');
  if (/<[a-z/!]/i.test(t)) return null;
  return unescapeHTML(t);
}

// The reverse of textToCampaignHTML, for editing a campaign written in this
// app as text again. Returns null when the HTML has other markup (written
// elsewhere, or with other formatting): it's then edited as HTML.
export function campaignHTMLToText(html: string): string | null {
  let src = html.trim();
  const out: string[] = [];
  while (src) {
    const m = /^<(p|h2|ul)>([\s\S]*?)<\/\1>\s*/.exec(src);
    if (!m) return null;
    src = src.slice(m[0].length);
    if (m[1] === 'ul') {
      const items = m[2].split(/<\/li>\s*/).filter((x) => x.trim());
      const lines: string[] = [];
      for (const it of items) {
        const li = /^\s*<li>([\s\S]*)$/.exec(it);
        const t = li && inlineToText(li[1]);
        if (t === null || t === undefined || t.includes('\n')) return null;
        lines.push(`- ${t}`);
      }
      out.push(lines.join('\n'));
      continue;
    }
    const t = inlineToText(m[2]);
    if (t === null) return null;
    out.push(m[1] === 'h2' ? `## ${t}` : t);
  }
  return out.join('\n\n');
}

export type Format = 'bold' | 'italic' | 'link' | 'heading' | 'list' | 'image';
export interface Edit { value: string; start: number; end: number }

// Applies a formatting button to the selection of the text field. The
// returned selection is what the user types next (the link's address, or
// the formatted words).
export function applyFormat(value: string, start: number, end: number, format: Format, url = ''): Edit {
  const sel = value.slice(start, end);
  const put = (text: string, selFrom: number, selTo: number): Edit =>
    ({ value: value.slice(0, start) + text + value.slice(end), start: start + selFrom, end: start + selTo });
  switch (format) {
    case 'bold':
    case 'italic': {
      const mark = format === 'bold' ? '**' : '*';
      const words = sel || (format === 'bold' ? 'texte en gras' : 'texte en italique');
      return put(`${mark}${words}${mark}`, mark.length, mark.length + words.length);
    }
    case 'link': {
      const words = sel || 'texte du lien';
      const addr = url || 'https://';
      return put(`[${words}](${addr})`, words.length + 3, words.length + 3 + addr.length);
    }
    case 'image': {
      // An image goes on its own paragraph.
      const before = value.slice(0, start);
      const pad = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
      const text = `${pad}![${sel}](${url})\n\n`;
      return put(text, text.length, text.length);
    }
    case 'heading':
    case 'list': {
      // Works on whole lines.
      const lineStart = value.lastIndexOf('\n', start - 1) + 1;
      const nl = value.indexOf('\n', end);
      const lineEnd = nl === -1 ? value.length : nl;
      const lines = value.slice(lineStart, lineEnd).split('\n');
      const prefix = format === 'heading' ? '## ' : '- ';
      const on = lines.every((l) => l.startsWith(prefix));
      const out = lines.map((l) => (on ? l.slice(prefix.length) : prefix + l.replace(/^(## |- )/, ''))).join('\n');
      return { value: value.slice(0, lineStart) + out + value.slice(lineEnd), start: lineStart, end: lineStart + out.length };
    }
  }
}
