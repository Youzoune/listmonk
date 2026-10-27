import { describe, expect, it } from 'vitest';
import { SLUG_MAX, hasAllProjects, isValidDomain, isValidSlug, slugify, toggleId } from './projects';

describe('slugify', () => {
  it('builds a slug the server accepts from any name', () => {
    expect(slugify('Clubs sportifs — Île-de-France')).toBe('clubs-sportifs-ile-de-france');
    expect(slugify('  WeSportive  ')).toBe('wesportive');
    expect(slugify('Agence & Co. (Lyon)')).toBe('agence-co-lyon');
    expect(isValidSlug(slugify('Été 2026 !'))).toBe(true);
  });

  it('never ends with a dash after truncation', () => {
    const s = slugify(`${'a'.repeat(63)} b`);
    expect(s.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(s.endsWith('-')).toBe(false);
  });

  it('returns an empty slug for names without letters or digits', () => {
    expect(slugify('— !')).toBe('');
    expect(isValidSlug('')).toBe(false);
  });
});

describe('validation', () => {
  it('checks slugs like the server', () => {
    expect(isValidSlug('sport-2026')).toBe(true);
    expect(isValidSlug('Sport')).toBe(false);
    expect(isValidSlug('a--b')).toBe(false);
    expect(isValidSlug('-a')).toBe(false);
  });

  it('accepts hostnames or nothing as a domain', () => {
    expect(isValidDomain('')).toBe(true);
    expect(isValidDomain('news.wesportive.fr')).toBe(true);
    expect(isValidDomain('News.WeSportive.fr')).toBe(true);
    expect(isValidDomain('http://x.fr')).toBe(false);
    expect(isValidDomain('localhost')).toBe(false);
  });
});

describe('access', () => {
  it('gives every project to super admins and project managers', () => {
    expect(hasAllProjects({ id: 1, permissions: [] })).toBe(true);
    expect(hasAllProjects({ id: 4, permissions: ['projects:manage'] })).toBe(true);
    expect(hasAllProjects({ id: 4, permissions: ['projects:get'] })).toBe(false);
    expect(hasAllProjects(undefined)).toBe(false);
  });

  it('adds and removes ids once', () => {
    expect(toggleId([1, 3], 2, true)).toEqual([1, 2, 3]);
    expect(toggleId([1, 2], 2, true)).toEqual([1, 2]);
    expect(toggleId([1, 2], 2, false)).toEqual([1]);
  });
});
