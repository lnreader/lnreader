import {
  buildLibraryGenres,
  filterNovelsByGenres,
  parseGenres,
} from '../genres';

const novels = [
  { name: 'Spaced', genres: ' Action ,  Slice  of Life,Horror ' },
  { name: 'Lowercase', genres: 'action,horror' },
  { name: 'Reaction', genres: 'Reaction, Action Comedy' },
  { name: 'Romance', genres: 'Romance, Harem' },
  { name: 'None', genres: null },
];

const names = (list: { name: string }[]) => list.map(novel => novel.name);

describe('parseGenres', () => {
  it('trims, collapses spaces and lower-cases each genre', () => {
    expect([...parseGenres(' Action ,  Slice  of Life,, ')]).toEqual([
      'action',
      'slice of life',
    ]);
  });

  it('returns no genres for an empty column', () => {
    expect(parseGenres(null).size).toBe(0);
    expect(parseGenres('').size).toBe(0);
  });
});

describe('filterNovelsByGenres', () => {
  it('returns the same list when no genre is selected', () => {
    expect(filterNovelsByGenres(novels, {})).toBe(novels);
  });

  it('matches whole genre names regardless of case and spacing', () => {
    expect(
      names(filterNovelsByGenres(novels, { included: ['action'] })),
    ).toEqual(['Spaced', 'Lowercase']);
    expect(
      names(filterNovelsByGenres(novels, { included: ['slice of life'] })),
    ).toEqual(['Spaced']);
  });

  it('requires every included genre', () => {
    expect(
      names(
        filterNovelsByGenres(novels, { included: ['action', 'slice of life'] }),
      ),
    ).toEqual(['Spaced']);
  });

  it('leaves out novels with any excluded genre, keeping those without genres', () => {
    expect(
      names(filterNovelsByGenres(novels, { excluded: ['horror', 'harem'] })),
    ).toEqual(['Reaction', 'None']);
  });

  it('combines included and excluded genres', () => {
    expect(
      names(
        filterNovelsByGenres(novels, {
          included: ['horror'],
          excluded: ['slice of life'],
        }),
      ),
    ).toEqual(['Lowercase']);
  });
});

describe('buildLibraryGenres', () => {
  it('merges spellings, counts novels and labels each genre by its most common spelling', () => {
    expect(
      buildLibraryGenres([
        { genres: 'Action, Horror', novelCount: 3 },
        { genres: 'action , romance, Romance', novelCount: 1 },
        { genres: ' slice  of life', novelCount: 2 },
        { genres: null, novelCount: 5 },
      ]),
    ).toEqual([
      { name: 'action', label: 'Action', novelCount: 4 },
      { name: 'horror', label: 'Horror', novelCount: 3 },
      { name: 'romance', label: 'romance', novelCount: 1 },
      { name: 'slice of life', label: 'slice of life', novelCount: 2 },
    ]);
  });
});
