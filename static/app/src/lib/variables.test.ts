import { describe, expect, it } from 'vitest';
import { fromTemplate, preview, toTemplate } from './variables';

describe('toTemplate', () => {
  it('replaces every readable token with its listmonk template', () => {
    expect(toTemplate('Bonjour {prénom}, à {ville} ? {prénom}')).toBe(
      'Bonjour {{ .Subscriber.FirstName }}, à {{ .Subscriber.Attribs.ville | default "" }} ? {{ .Subscriber.FirstName }}',
    );
  });

  it('leaves unknown tokens and plain braces alone', () => {
    expect(toTemplate('Code {promo} et {}')).toBe('Code {promo} et {}');
  });
});

describe('fromTemplate', () => {
  it('reverses toTemplate', () => {
    const text = 'Bonjour {prénom} {nom}, ({organisation}, {ville}) — {email}';
    expect(fromTemplate(toTemplate(text))).toBe(text);
  });

  it('accepts templates written without spaces', () => {
    expect(fromTemplate('Bonjour {{.Subscriber.FirstName}} de {{ .Subscriber.Attribs.ville|default "" }}')).toBe('Bonjour {prénom} de {ville}');
  });

  it('keeps other Go templates untouched', () => {
    expect(fromTemplate('{{ UnsubscribeURL }}')).toBe('{{ UnsubscribeURL }}');
  });
});

describe('preview', () => {
  it('uses the given values and falls back to samples', () => {
    expect(preview('{prénom} de {ville}', { prénom: 'Inès' })).toBe('Inès de Créteil');
  });
});
