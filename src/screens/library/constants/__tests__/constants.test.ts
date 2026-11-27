import {
  getLibraryCategoryIndex,
  LegacyLibraryFilter,
  nextLibraryFilterState,
  resolveLibraryFilters,
} from '../constants';

const categories = [{ id: 1 }, { id: 7 }, { id: 12 }];

describe('getLibraryCategoryIndex', () => {
  it('returns the index of the saved category', () => {
    expect(getLibraryCategoryIndex(categories, 7)).toBe(1);
  });

  it('falls back to the first category when the saved category is unavailable', () => {
    expect(getLibraryCategoryIndex(categories, 99)).toBe(0);
  });

  it('finds the saved category after categories are reordered', () => {
    expect(getLibraryCategoryIndex([{ id: 7 }, { id: 1 }, { id: 12 }], 7)).toBe(
      0,
    );
  });
});

describe('nextLibraryFilterState', () => {
  it('cycles off, include, exclude and back to off', () => {
    expect(nextLibraryFilterState(undefined)).toBe('include');
    expect(nextLibraryFilterState('include')).toBe('exclude');
    expect(nextLibraryFilterState('exclude')).toBeUndefined();
  });
});

describe('resolveLibraryFilters', () => {
  it.each([
    [LegacyLibraryFilter.Downloaded, 'downloaded'],
    [LegacyLibraryFilter.DownloadedOnly, 'downloaded'],
    [LegacyLibraryFilter.Unread, 'unread'],
    [LegacyLibraryFilter.Started, 'started'],
    [LegacyLibraryFilter.Completed, 'completed'],
    [LegacyLibraryFilter.CustomUpdateFrequency, 'customUpdateFrequency'],
  ])('keeps a saved legacy filter %p as an include', (legacy, key) => {
    expect(resolveLibraryFilters(undefined, legacy)).toEqual({
      [key]: 'include',
    });
  });

  it('prefers saved filters over the legacy one, even when all are off', () => {
    expect(
      resolveLibraryFilters({ unread: 'exclude' }, LegacyLibraryFilter.Started),
    ).toEqual({ unread: 'exclude' });
    expect(resolveLibraryFilters({}, LegacyLibraryFilter.Started)).toEqual({});
  });

  it('ignores a missing or unknown legacy filter', () => {
    expect(resolveLibraryFilters()).toEqual({});
    expect(resolveLibraryFilters(undefined, 'DROP TABLE Novel')).toEqual({});
    expect(resolveLibraryFilters(undefined, 'constructor')).toEqual({});
  });
});
