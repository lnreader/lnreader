import { buildLibraryGenres, filterNovelsByGenres } from '../genres';

const novels = [
  { name: 'Spaced', genres: ' Action ,  Slice  of Life,Horror ' },
  { name: 'Lowercase', genres: 'action,horror' },
  { name: 'Reaction', genres: 'Reaction, Action Comedy' },
  { name: 'Romance', genres: 'Romance, Harem' },
  { name: 'None', genres: null },
];

const names = (list: { name: string }[]) => list.map(novel => novel.name);

describe('filterNovelsByGenres', () => {
  it('returns the same list when no genre is selected', () => {
    expect(filterNovelsByGenres(novels, {})).toBe(novels);
  });

  it('matches whole genre names regardless of case and spacing', () => {
    expect(
      names(filterNovelsByGenres(novels, { included: ['action'] })),
    ).toEqual(['Spaced', 'Lowercase']);
    expect(
      names(filterNovelsByGenres(novels, { included: ['sliceoflife'] })),
    ).toEqual(['Spaced']);
  });

  it('requires every included genre', () => {
    expect(
      names(
        filterNovelsByGenres(novels, { included: ['action', 'sliceoflife'] }),
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
          excluded: ['sliceoflife'],
        }),
      ),
    ).toEqual(['Lowercase']);
  });
});

describe('buildLibraryGenres', () => {
  it('merges spellings of a genre into one entry that filters all of them', () => {
    const library = [
      { name: 'Hyphen', genres: 'Sci-Fi' },
      { name: 'Space', genres: 'Sci Fi' },
      { name: 'Joined', genres: 'scifi' },
      { name: 'Repeat', genres: 'Sci Fi' },
    ];

    const genres = buildLibraryGenres(library);

    expect(genres).toEqual([{ name: expect.any(String), label: 'Sci Fi' }]);
    expect(
      names(filterNovelsByGenres(library, { included: [genres[0].name] })),
    ).toEqual(['Hyphen', 'Space', 'Joined', 'Repeat']);
  });

  it('labels a tie with the spelling seen first', () => {
    expect(
      buildLibraryGenres([{ genres: 'HORROR' }, { genres: 'Horror' }]).map(
        genre => genre.label,
      ),
    ).toEqual(['HORROR']);
  });

  it('keeps non-Latin genres distinct and filterable', () => {
    const library = [
      { name: 'Xuanhuan', genres: '玄幻' },
      { name: 'Romance', genres: '言情' },
      { name: 'Hindi', genres: 'कहानी' },
    ];

    const genres = buildLibraryGenres(library);

    expect(genres.map(genre => genre.label).sort()).toEqual(
      ['玄幻', '言情', 'कहानी'].sort(),
    );
    const xuanhuan = genres.find(genre => genre.label === '玄幻')!;
    expect(
      names(filterNovelsByGenres(library, { included: [xuanhuan.name] })),
    ).toEqual(['Xuanhuan']);
    expect(
      names(filterNovelsByGenres(library, { excluded: [xuanhuan.name] })),
    ).toEqual(['Romance', 'Hindi']);
  });

  it('lists genres that contain one another separately', () => {
    expect(buildLibraryGenres(novels.slice(1, 3))).toEqual([
      { name: 'action', label: 'action' },
      { name: 'actioncomedy', label: 'Action Comedy' },
      { name: 'horror', label: 'horror' },
      { name: 'reaction', label: 'Reaction' },
    ]);
  });
});
