import { describe, expect, it } from 'vitest';
import { brandOf, isStockTemplate, missingBrands, suggestProject } from './migration';

const projects = [{ id: 1, name: 'Default', slug: 'default' }, { id: 2, name: 'Youzoune', slug: 'youzoune' }];

describe('listmonk import', () => {
  it('reads the brand of a list', () => {
    expect(brandOf('Youzoune - Restaurants & bars')).toBe('Youzoune');
    expect(brandOf('wesportive · newsletter')).toBe('wesportive');
    expect(brandOf('Test liste')).toBeNull();
    expect(brandOf('Opt-in list')).toBeNull();
  });

  it('suggests the project of the brand and the missing ones', () => {
    expect(suggestProject('Youzoune - Boulangeries', projects)).toBe(2);
    expect(suggestProject('WeSportive - newsletter gérants', projects)).toBeNull();
    expect(missingBrands(['WeSportive - a', 'Youzoune - b', 'wesportive · c', 'Fidélisemoi - d'], projects)).toEqual(['WeSportive', 'Fidélisemoi']);
  });

  it('skips the stock templates', () => {
    expect(isStockTemplate('Default campaign template')).toBe(true);
    expect(isStockTemplate('Youzoune - Prospection (sobre)')).toBe(false);
  });
});
