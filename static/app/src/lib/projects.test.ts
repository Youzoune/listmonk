import { describe, expect, it } from 'vitest';
import { SLUG_MAX, hasAllProjects, isValidDomain, isValidSlug, slugify, toggleId, isUnderBase, projectSubdomain, publicURLs, rootHost } from './projects';

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

describe('publicURLs', () => {
  it('uses a custom domain, with the instance scheme, port and path', () => {
    const u = publicURLs({ id: 2, slug: 'sport', domain: 'News.Sport.fr' }, 'http://example.org:8080/listmonk/', 'example.org');
    expect(u).toEqual({
      root: 'http://news.sport.fr:8080/listmonk',
      form: 'http://news.sport.fr:8080/listmonk/subscription/form',
      archive: 'http://news.sport.fr:8080/listmonk/archive',
      feed: 'http://news.sport.fr:8080/listmonk/archive.xml',
      host: 'news.sport.fr',
      kind: 'custom',
    });
  });

  it('gives every project but the default one a subdomain of the base domain', () => {
    const u = publicURLs({ id: 3, slug: 'culture', domain: null }, 'https://relais.youzoune.fr', 'relais.youzoune.fr');
    expect(u.root).toBe('https://culture.relais.youzoune.fr');
    expect(u.kind).toBe('subdomain');
    expect(publicURLs({ id: 1, slug: 'default', domain: null }, 'https://relais.youzoune.fr', 'relais.youzoune.fr').kind).toBe('instance');
    expect(projectSubdomain({ id: 2, slug: 'a'.repeat(64) }, 'x.fr')).toBe('');
    expect(isUnderBase('club.relais.youzoune.fr', 'relais.youzoune.fr')).toBe(true);
    expect(isUnderBase('news.club.fr', 'relais.youzoune.fr')).toBe(false);
  });

  it('falls back to the instance address with the project slug', () => {
    expect(publicURLs({ id: 3, slug: 'culture', domain: null }, 'https://lists.example.org').archive)
      .toBe('https://lists.example.org/archive?project=culture');
    expect(publicURLs({ id: 1, slug: 'default', domain: null }, 'https://lists.example.org').form)
      .toBe('https://lists.example.org/subscription/form');
    expect(rootHost('https://lists.example.org/x')).toBe('lists.example.org');
  });
});
