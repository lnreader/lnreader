export const parseGenres = (genres: unknown): string[] =>
  typeof genres === 'string'
    ? genres
        .split(',')
        .map(genre => genre.trim())
        .filter(Boolean)
    : [];
