import {
  getLibraryGenreOptions,
  matchesGenreFilter,
} from '@screens/library/utils/genreFilter';
import { resolveLibraryFilters } from '@screens/library/constants/constants';

describe('getLibraryGenreOptions', () => {
  it('groups spelling variants and labels them with the most common spelling', () => {
    const options = getLibraryGenreOptions([
      { genres: 'Sci-fi, Horror' },
      { genres: 'Sci-fi,Romance' },
      { genres: 'sci fi' },
      { genres: null },
    ]);

    expect(options).toEqual([
      { key: 'Horror', label: 'Horror' },
      { key: 'Romance', label: 'Romance' },
      { key: 'Scifi', label: 'Sci-fi' },
    ]);
  });

  it('keeps selected genres listed after they leave the library', () => {
    const options = getLibraryGenreOptions([{ genres: 'Action' }], {
      include: [],
      exclude: ['Harem'],
    });

    expect(options.map(option => option.key)).toEqual(['Action', 'Harem']);
  });
});

describe('matchesGenreFilter', () => {
  it('matches whole genres rather than substrings', () => {
    const filter = { include: ['Romance'], exclude: [] };

    expect(matchesGenreFilter('Romance Fantasy, Action', filter)).toBe(false);
    expect(matchesGenreFilter('Action, romance', filter)).toBe(true);
  });

  it('requires every included genre and rejects any excluded genre', () => {
    const filter = { include: ['Horror', 'Mystery'], exclude: ['Harem'] };

    expect(matchesGenreFilter('Horror, Mystery', filter)).toBe(true);
    expect(matchesGenreFilter('Horror', filter)).toBe(false);
    expect(matchesGenreFilter('Horror, Mystery, Harem', filter)).toBe(false);
  });

  it('keeps novels without genres unless a genre is required', () => {
    expect(matchesGenreFilter(null, { include: [], exclude: ['Harem'] })).toBe(
      true,
    );
    expect(matchesGenreFilter(null, { include: ['Horror'], exclude: [] })).toBe(
      false,
    );
  });
});

describe('resolveLibraryFilters', () => {
  it('migrates the legacy single SQL filter to an included filter', () => {
    expect(resolveLibraryFilters(undefined, "status LIKE 'Completed'")).toEqual(
      { completed: 'include' },
    );
    expect(resolveLibraryFilters(undefined, 'unknown clause')).toEqual({});
  });

  it('prefers the new filters once they have been saved', () => {
    expect(
      resolveLibraryFilters({ started: 'exclude' }, 'lastReadAt IS NULL'),
    ).toEqual({ started: 'exclude' });
  });
});
