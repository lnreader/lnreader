/**
 * chunkSplitter — pure function tests (spec-1576 AC3/AC7, RED first).
 *
 * Contract (from spec R1/R3):
 * - Splits normalized text into flash chunks of `chunkSize` words (1–3).
 * - Tokens longer than 12 characters are split across their own flashes
 *   (greedy pieces of up to 12 chars); every non-final piece is flagged
 *   `continuesNext`, every non-initial piece `continuationOfPrev`.
 *   Ellipsis rendering is rsvp.js's job — the splitter only flags.
 * - Each chunk carries `orpIndex`: the zero-based index of the ORP letter
 *   = center letter of the chunk text (left-of-center for even lengths:
 *   Math.floor((len - 1) / 2)).
 * - Chunk text preserves single-space joins (input arrives normalized).
 */

import { chunkSplitter } from '../chunkSplitter';

describe('chunkSplitter — basic word grouping', () => {
  it('chunks single words by default (chunkSize 1)', () => {
    const result = chunkSplitter('The quick brown fox', 1);

    expect(result.map(chunk => chunk.text)).toEqual([
      'The',
      'quick',
      'brown',
      'fox',
    ]);
  });

  it('groups 2 and 3 words per chunk', () => {
    expect(
      chunkSplitter('The quick brown fox jumps', 2).map(c => c.text),
    ).toEqual(['The quick', 'brown fox', 'jumps']);

    expect(
      chunkSplitter('One two three four five six', 3).map(c => c.text),
    ).toEqual(['One two three', 'four five six']);
  });

  it('keeps a trailing partial group as its own smaller chunk', () => {
    const result = chunkSplitter('alpha beta gamma delta', 3);

    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('alpha beta gamma');
    expect(result[1].text).toBe('delta');
  });

  it('returns an empty array for empty input', () => {
    expect(chunkSplitter('', 1)).toEqual([]);
  });
});

describe('chunkSplitter — ORP index', () => {
  it("marks the center letter (left-of-center when even) of each chunk's text", () => {
    const [one] = chunkSplitter('fox', 1);
    expect(one.orpIndex).toBe(1); // f-o|x -> 'o'

    const [two] = chunkSplitter('word', 1);
    expect(two.orpIndex).toBe(1); // w-o|r-d -> 'o'

    const [phrase] = chunkSplitter('big cat', 2);
    // 'big cat' has 7 letters+space = len 7, center idx 3 ('space')
    expect(phrase.text).toBe('big cat');
    expect(phrase.orpIndex).toBe(3);
  });

  it('ORP indexes stay valid for every emitted chunk', () => {
    const chunks = chunkSplitter(
      'A somewhat longer sentence for property testing.',
      2,
    );
    for (const chunk of chunks) {
      expect(chunk.orpIndex).toBeGreaterThanOrEqual(0);
      expect(chunk.orpIndex).toBeLessThan(chunk.text.length);
    }
  });
});

describe('chunkSplitter — long-token splitting (>12 chars)', () => {
  it('splits a 13-char token into pieces of up to 12 chars on separate flashes', () => {
    const result = chunkSplitter('extraordinarily', 1);
    // 15 chars -> pieces 'extraordinar' (12) + 'ily' (3)
    expect(result).toHaveLength(2);
    expect(result[0].text).toBe('extraordinar');
    expect(result[0].continuesNext).toBe(true);
    expect(result[0].continuationOfPrev).toBe(false);
    expect(result[1].text).toBe('ily');
    expect(result[1].continuesNext).toBe(false);
    expect(result[1].continuationOfPrev).toBe(true);
  });

  it('does NOT flag a 12-char token — exactly at the limit stays whole', () => {
    const result = chunkSplitter('extraordinal', 1);
    expect(result).toHaveLength(1);
    expect(result[0].continuesNext).toBe(false);
    expect(result[0].continuationOfPrev).toBe(false);
  });

  it('long-token flashes bypass chunk grouping entirely', () => {
    const result = chunkSplitter('see extraordinarily fast', 2);
    expect(result.map(c => c.text)).toEqual([
      'see',
      'extraordinar',
      'ily',
      'fast',
    ]);
    expect(result[0].continuesNext).toBe(false);
    expect(result[1].continuesNext).toBe(true);
    expect(result[2].continuationOfPrev).toBe(true);
  });

  it('piece boundaries never exceed 12 characters', () => {
    const longToken = 'x'.repeat(40);
    const result = chunkSplitter(longToken, 1);
    for (const chunk of result) {
      expect(chunk.text.length).toBeLessThanOrEqual(12);
    }
    // 40 chars -> 4 pieces (12/12/12/4)
    expect(result).toHaveLength(4);
    expect(result.join('').length ? result.map(c => c.text).join('') : '').toBe(
      longToken,
    );
    expect(result[result.length - 1].continuesNext).toBe(false);
  });
});
