import { normalizeGenre } from '@screens/GenreStatsScreen/utils';
import { parseGenres } from '@screens/novel/utils/genres';
import type { LibraryGenreFilter } from '@screens/library/constants/constants';

export interface LibraryGenreOption {
  key: string;
  label: string;
}

const genreKeys = (genres: string | null | undefined) =>
  new Set(parseGenres(genres).map(normalizeGenre));

/**
 * Lists the genres present in the library, grouping spelling variants under
 * one normalized key and labelling each with its most common spelling.
 * Genres still selected in `genreFilter` stay listed even if no novel has them,
 * so the user can always clear them.
 */
export const getLibraryGenreOptions = (
  novels: { genres?: string | null }[],
  genreFilter?: LibraryGenreFilter,
): LibraryGenreOption[] => {
  const variantsByKey = new Map<string, Map<string, number>>();

  for (const novel of novels) {
    for (const genre of parseGenres(novel.genres)) {
      const key = normalizeGenre(genre);
      const variants = variantsByKey.get(key) ?? new Map<string, number>();
      variants.set(genre, (variants.get(genre) ?? 0) + 1);
      variantsByKey.set(key, variants);
    }
  }

  const options: LibraryGenreOption[] = [...variantsByKey].map(
    ([key, variants]) => {
      let label = key;
      let bestCount = 0;
      for (const [variant, count] of variants) {
        if (count > bestCount) {
          label = variant;
          bestCount = count;
        }
      }
      return { key, label };
    },
  );

  for (const key of [
    ...(genreFilter?.include ?? []),
    ...(genreFilter?.exclude ?? []),
  ]) {
    if (!variantsByKey.has(key)) {
      options.push({ key, label: key });
    }
  }

  return options.sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
};

export const hasGenreFilter = (genreFilter?: LibraryGenreFilter) =>
  !!genreFilter?.include.length || !!genreFilter?.exclude.length;

/** A novel must have every included genre and none of the excluded ones. */
export const matchesGenreFilter = (
  genres: string | null | undefined,
  genreFilter?: LibraryGenreFilter,
) => {
  if (!hasGenreFilter(genreFilter)) {
    return true;
  }
  const keys = genreKeys(genres);
  return (
    genreFilter!.include.every(key => keys.has(key)) &&
    !genreFilter!.exclude.some(key => keys.has(key))
  );
};
