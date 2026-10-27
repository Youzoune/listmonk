import { describe, expect, it } from 'vitest';
import { count, initials, percent, relayLabel, senderName } from './format';

describe('format', () => {
  it('extracts the display name of a sender', () => {
    expect(senderName('Ahmed de WeSportive <ahmed@wesportive.fr>')).toBe('Ahmed de WeSportive');
    expect(senderName('"Youzoune" <bonjour@youzoune.com>')).toBe('Youzoune');
    expect(senderName('noreply@example.com')).toBe('noreply@example.com');
  });

  it('rounds percentages and handles empty totals', () => {
    expect(percent(41, 238)).toBe('17 %');
    expect(percent(3, 0)).toBe('—');
  });

  it('names relays the way people read them', () => {
    expect(relayLabel('email')).toBe('Relais par défaut');
    expect(relayLabel('sport-ses')).toBe('sport-ses');
    expect(relayLabel('email-sport-ses')).toBe('sport-ses');
  });

  it('agrees counts in French', () => {
    expect(count(0, 'brouillon')).toBe('0 brouillon');
    expect(count(1, 'publique')).toBe('1 publique');
    expect(count(1200, 'contact')).toBe(`${new Intl.NumberFormat('fr-FR').format(1200)} contacts`);
  });

  it('builds initials from names', () => {
    expect(initials('WeSportive')).toBe('W');
    expect(initials('Clubs sportifs — Île-de-France')).toBe('CS');
  });
});
