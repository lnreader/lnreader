export const parseGenres = (genres: unknown): string[] =>
  typeof genres === 'string'
    ? genres
        .split(',')
        .map(genre => genre.trim())
        .filter(Boolean)
    : [];

/** Spellings of one genre, such as "Sci-Fi" and "scifi", share a key. */
export const getGenreKey = (genre: string): string =>
  genre.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]/gu, '');
