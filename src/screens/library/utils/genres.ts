import { getGenreKey, parseGenres } from '@screens/novel/utils/genres';

export interface GenreFilter {
  included?: string[];
  excluded?: string[];
}

/** A novel must have every included genre and none of the excluded ones. */
export const filterNovelsByGenres = <T extends { genres?: string | null }>(
  novels: T[],
  { included = [], excluded = [] }: GenreFilter,
): T[] => {
  if (!included.length && !excluded.length) {
    return novels;
  }
  return novels.filter(novel => {
    const genres = new Set(parseGenres(novel.genres).map(getGenreKey));
    return (
      included.every(genre => genres.has(genre)) &&
      !excluded.some(genre => genres.has(genre))
    );
  });
};

export interface LibraryGenre {
  /** Genre key, as stored in the filter settings. */
  name: string;
  /** The most common spelling, or the first seen on a tie. */
  label: string;
}

export const buildLibraryGenres = (
  novels: { genres: string | null }[],
): LibraryGenre[] => {
  const genres = new Map<string, Map<string, number>>();

  for (const novel of novels) {
    for (const spelling of parseGenres(novel.genres)) {
      const name = getGenreKey(spelling);
      if (!name) {
        continue;
      }
      const spellings = genres.get(name) ?? new Map<string, number>();
      spellings.set(spelling, (spellings.get(spelling) ?? 0) + 1);
      genres.set(name, spellings);
    }
  }

  return Array.from(genres, ([name, spellings]) => ({
    name,
    label: Array.from(spellings).reduce((best, next) =>
      next[1] > best[1] ? next : best,
    )[0],
  })).sort((a, b) => a.label.localeCompare(b.label));
};
