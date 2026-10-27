import { describe, expect, it } from 'vitest';
import { attribsFromRows, attribsToRows } from './subscribers';

describe('contact attributes', () => {
  it('round-trips text and other values', () => {
    const attribs = { ville: 'Lyon', age: 34, vip: true, adresse: { cp: '69001' } };
    expect(attribsFromRows(attribsToRows(attribs))).toEqual({ attribs });
  });

  it('skips empty rows and explains mistakes', () => {
    expect(attribsFromRows([{ key: '', value: '' }, { key: 'ville', value: 'Paris' }])).toEqual({ attribs: { ville: 'Paris' } });
    expect(attribsFromRows([{ key: '', value: 'x' }]).error).toBeTruthy();
    expect(attribsFromRows([{ key: 'a', value: '1' }, { key: 'a', value: '2' }]).error).toContain('deux fois');
    expect(attribsFromRows([{ key: 'age', value: '{oops', json: true }]).error).toContain('JSON');
  });
});
