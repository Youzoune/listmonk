import { describe, expect, it } from 'vitest';
import { textToCampaignHTML } from './body';

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
