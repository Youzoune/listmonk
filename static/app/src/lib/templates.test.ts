import { describe, expect, it } from 'vitest';
import { CONTENT_TAG, STARTERS, hasContentTag, templateErrors } from './templates';

describe('templates', () => {
  it('finds the content tag however it is spaced', () => {
    expect(hasContentTag(`<div>${CONTENT_TAG}</div>`)).toBe(true);
    expect(hasContentTag('{{template "content" .}}')).toBe(true);
    expect(hasContentTag('{{ template "other" . }}')).toBe(false);
  });

  it('accepts the starters and explains what is missing', () => {
    expect(templateErrors({ name: 'Lettre', type: 'campaign', ...STARTERS.campaign })).toEqual({});
    expect(templateErrors({ name: 'Commande', type: 'tx', ...STARTERS.tx })).toEqual({});
    expect(Object.keys(templateErrors({ name: '', type: 'campaign', subject: '', body: '<p>x</p>' })).sort()).toEqual(['body', 'name']);
    expect(templateErrors({ name: 'A', type: 'tx', subject: ' ', body: 'x' }).subject).toBeTruthy();
  });
});
