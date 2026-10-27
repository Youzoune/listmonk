import { describe, expect, it } from 'vitest';
import { campaignHTMLToText, textToCampaignHTML } from './body';
import { ACTIONS, analyticsRange, isEditable, rate } from './campaigns';

describe('campaign body', () => {
  it('turns text written here back into text', () => {
    const text = 'Bonjour {prénom},\n\nÀ samedi <3 & merci.\nLe club';
    expect(campaignHTMLToText(textToCampaignHTML(text))).toBe(text);
  });

  it('keeps other HTML as HTML', () => {
    expect(campaignHTMLToText('<h1>Titre</h1><p>x</p>')).toBeNull();
    expect(campaignHTMLToText('<p>Un <strong>mot</strong></p>')).toBeNull();
    expect(campaignHTMLToText('')).toBe('');
  });
});

describe('campaign actions', () => {
  it('offers what each status allows', () => {
    expect(ACTIONS.draft).toContain('start');
    expect(ACTIONS.running).toEqual(['pause', 'cancel']);
    expect(ACTIONS.finished).toEqual([]);
    expect(isEditable('paused')).toBe(true);
    expect(isEditable('running')).toBe(false);
  });

  it('formats rates and date ranges', () => {
    expect(rate(1, 3)).toBe('33 %');
    expect(rate(1, 40)).toBe('2,5 %');
    expect(rate(1, 0)).toBe('—');
    expect(analyticsRange('2026-10-20T10:00:00Z', new Date('2026-10-27T12:00:00Z'))).toEqual({ from: '2026-10-20', to: '2026-10-28' });
  });
});
