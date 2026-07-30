import { parseGenres } from '../genres';

describe('parseGenres', () => {
  it('normalizes comma-separated genres', () => {
    expect(parseGenres('Fantasy,  Adventure, , Romance ')).toEqual([
      'Fantasy',
      'Adventure',
      'Romance',
    ]);
  });

  it.each([undefined, null, ['Fantasy'], { genre: 'Fantasy' }])(
    'returns an empty list for malformed input: %p',
    genres => {
      expect(parseGenres(genres)).toEqual([]);
    },
  );
});
