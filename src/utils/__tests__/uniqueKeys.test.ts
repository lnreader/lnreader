import { uniqueKeys } from '../uniqueKeys';

describe('uniqueKeys', () => {
  it('suffixes repeated keys', () => {
    expect(uniqueKeys(['x', 'y', 'x', 'x'], item => item)).toEqual([
      'x',
      'y',
      'x#1',
      'x#2',
    ]);
  });

  it('passes the index to the key extractor', () => {
    expect(uniqueKeys(['p', 'q'], (_, index) => `row-${index}`)).toEqual([
      'row-0',
      'row-1',
    ]);
  });
});
