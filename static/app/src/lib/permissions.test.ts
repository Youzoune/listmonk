import { describe, expect, it } from 'vitest';
import { listAccess, setListAccess } from './permissions';

describe('list roles', () => {
  const grants = [{ id: 1, name: 'A', permissions: ['list:get'] }, { id: 9, name: 'Autre projet', permissions: ['list:get', 'list:manage'] }];

  it('reads the access of a list', () => {
    expect(listAccess(grants, 1)).toBe('get');
    expect(listAccess(grants, 9)).toBe('manage');
    expect(listAccess(grants, 2)).toBe('none');
  });

  it('sets, upgrades and removes access without touching other lists', () => {
    const g = setListAccess(grants, { id: 1, name: 'A' }, 'manage');
    expect(listAccess(g, 1)).toBe('manage');
    expect(g.find((x) => x.id === 1)?.permissions).toEqual(['list:get', 'list:manage']);
    const none = setListAccess(g, { id: 1, name: 'A' }, 'none');
    expect(none).toEqual([grants[1]]);
    expect(setListAccess([], { id: 3, name: 'C' }, 'get')).toEqual([{ id: 3, name: 'C', permissions: ['list:get'] }]);
  });
});
