import { afterEach, describe, expect, it } from 'vitest';
import { PROJECT_COOKIE, isSessionError, loginURL, query, setCurrentProject } from './client';

describe('client', () => {
  afterEach(() => setCurrentProject(null));

  it('keeps the current project in a cookie for the legacy admin', () => {
    setCurrentProject(3);
    expect(document.cookie).toContain(`${PROJECT_COOKIE}=3`);
    setCurrentProject(null);
    expect(document.cookie).not.toContain(`${PROJECT_COOKIE}=`);
  });

  it('builds query strings without empty values', () => {
    expect(query({ a: 1, b: '', c: undefined, s: ['x', 'y'] })).toBe('?a=1&s=x&s=y');
    expect(query({})).toBe('');
  });

  it('recognises expired sessions and builds the login URL', () => {
    expect(isSessionError(403, 'invalid session')).toBe(true);
    expect(isSessionError(403, 'permission denied')).toBe(false);
    expect(loginURL('/app/audience?q=a')).toBe('/admin/login?next=%2Fapp%2Faudience%3Fq%3Da');
  });
});
