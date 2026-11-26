/**
 * Sources spell the same genre differently ("Slice of Life", " slice of life"),
 * so genres are compared by this key rather than by their raw text.
 */
export const normalizeGenreName = (genre: string): string =>
  genre.trim().replace(/\s+/g, ' ').toLowerCase();

/** Splits a novel's comma-separated `genres` column into normalized names. */
export const parseGenres = (genres?: string | null): Set<string> => {
  const names = new Set<string>();
  if (!genres) {
    return names;
  }
  for (const part of genres.split(',')) {
    const name = normalizeGenreName(part);
    if (name) {
      names.add(name);
    }
  }
  return names;
};

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
    const genres = parseGenres(novel.genres);
    return (
      included.every(genre => genres.has(genre)) &&
      !excluded.some(genre => genres.has(genre))
    );
  });
};

export interface LibraryGenre {
  /** Normalized name, as stored in the filter settings. */
  name: string;
  /** The spelling most novels use. */
  label: string;
  novelCount: number;
}

/**
 * Builds the genre list from the library's distinct `genres` values, each with
 * how many novels carry it.
 */
export const buildLibraryGenres = (
  rows: { genres: string | null; novelCount: number }[],
): LibraryGenre[] => {
  const genres = new Map<
    string,
    { novelCount: number; spellings: Map<string, number> }
  >();

  for (const row of rows) {
    if (!row.genres) {
      continue;
    }
    const seen = new Set<string>();
    for (const part of row.genres.split(',')) {
      const spelling = part.trim().replace(/\s+/g, ' ');
      const name = normalizeGenreName(spelling);
      if (!name) {
        continue;
      }
      let genre = genres.get(name);
      if (!genre) {
        genre = { novelCount: 0, spellings: new Map() };
        genres.set(name, genre);
      }
      genre.spellings.set(
        spelling,
        (genre.spellings.get(spelling) ?? 0) + row.novelCount,
      );
      // A novel listing a genre twice still counts once.
      if (!seen.has(name)) {
        seen.add(name);
        genre.novelCount += row.novelCount;
      }
    }
  }

  return Array.from(genres, ([name, { novelCount, spellings }]) => {
    let label = name;
    let labelCount = -1;
    for (const [spelling, count] of spellings) {
      if (count > labelCount) {
        label = spelling;
        labelCount = count;
      }
    }
    return { name, label, novelCount };
  }).sort((a, b) => a.label.localeCompare(b.label));
};
