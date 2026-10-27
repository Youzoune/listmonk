import { describe, expect, it } from 'vitest';
import { applyFormat, campaignHTMLToText, textToCampaignHTML } from './body';

describe('textToCampaignHTML', () => {
  it('splits paragraphs and keeps line breaks', () => {
    expect(textToCampaignHTML('Bonjour {prénom},\n\nLigne 1\nLigne 2\n\n\nAhmed')).toBe(
      '<p>Bonjour {{ .Subscriber.FirstName }},</p>\n<p>Ligne 1<br>Ligne 2</p>\n<p>Ahmed</p>',
    );
  });

  it('escapes HTML typed in the text', () => {
    expect(textToCampaignHTML('<b>gras</b> & co')).toBe('<p>&lt;b&gt;gras&lt;/b&gt; &amp; co</p>');
  });

  it('keeps the quotes of attribute templates intact', () => {
    expect(textToCampaignHTML('À {ville}')).toBe('<p>À {{ .Subscriber.Attribs.ville | default "" }}</p>');
  });
});

describe('formatting', () => {
  const text = [
    '## Les nouvelles du club',
    'Bonjour {prénom}, la **saison** reprend *lundi*.\nInscriptions sur [notre site](https://club.fr/inscription?a=1&b=2).',
    '- Entraînement à 18 h\n- Match samedi',
    '![Affiche](https://club.fr/affiche.png)',
  ].join('\n\n');

  it('turns the marks into HTML', () => {
    const html = textToCampaignHTML(text);
    expect(html).toContain('<h2>Les nouvelles du club</h2>');
    expect(html).toContain('la <strong>saison</strong> reprend <em>lundi</em>.<br>');
    expect(html).toContain('<a href="https://club.fr/inscription?a=1&amp;b=2">notre site</a>');
    expect(html).toContain('<ul><li>Entraînement à 18 h</li><li>Match samedi</li></ul>');
    expect(html).toContain('<p><img src="https://club.fr/affiche.png" alt="Affiche"></p>');
  });

  it('reads the HTML back as the same text', () => {
    expect(campaignHTMLToText(textToCampaignHTML(text))).toBe(text);
  });

  it('refuses unsafe links and other markup', () => {
    expect(textToCampaignHTML('[x](javascript:alert(1))')).toBe('<p>[x](javascript:alert(1))</p>');
    expect(campaignHTMLToText('<p>a</p><table></table>')).toBeNull();
    expect(campaignHTMLToText('<p><span>a</span></p>')).toBeNull();
  });
});

describe('applyFormat', () => {
  it('wraps the selection or inserts a placeholder', () => {
    expect(applyFormat('un mot ici', 3, 6, 'bold')).toEqual({ value: 'un **mot** ici', start: 5, end: 8 });
    const e = applyFormat('voir ', 5, 5, 'link');
    expect(e.value).toBe('voir [texte du lien](https://)');
    expect(e.value.slice(e.start, e.end)).toBe('https://');
  });

  it('toggles headings and lists on whole lines', () => {
    const v = 'Intro\n\nun\ndeux';
    const l = applyFormat(v, 8, 12, 'list');
    expect(l.value).toBe('Intro\n\n- un\n- deux');
    expect(applyFormat(l.value, l.start, l.end, 'list').value).toBe(v);
    expect(applyFormat('Titre', 2, 2, 'heading').value).toBe('## Titre');
  });

  it('puts an image on its own paragraph', () => {
    expect(applyFormat('Texte', 5, 5, 'image', 'https://x.fr/a.png').value).toBe('Texte\n\n![](https://x.fr/a.png)\n\n');
  });
});
