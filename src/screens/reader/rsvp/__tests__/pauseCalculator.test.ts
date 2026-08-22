/**
 * pauseCalculator — pure function tests (spec-1576 R2/AC2, RED first).
 *
 * Contract (from spec R2):
 * - Base interval = 60000 / WPM (250 WPM -> 240ms ≈ 4 flashes/s).
 * - Punctuation-proportional multipliers on the chunk's final character:
 *     paragraph break ('\n') ×3, sentence end (. ! ?) ×2.5,
 *     comma-class (, ; :) ×1.5, anything else ×1.
 * - Result is always a positive integer number of milliseconds.
 */

import { pauseCalculator } from '../pauseCalculator';

const BASE_AT_250 = 60000 / 250; // 240ms

describe('pauseCalculator — base cadence', () => {
  it('returns exactly 60000/WPM for plain words', () => {
    expect(pauseCalculator('word', 250)).toBe(BASE_AT_250);
    expect(pauseCalculator('hello world', 300)).toBe(60000 / 300);
  });

  it('scales inversely with WPM', () => {
    expect(pauseCalculator('word', 500)).toBe(120);
    expect(pauseCalculator('word', 150)).toBe(400);
  });
});

describe('pauseCalculator — punctuation multipliers', () => {
  it.each([
    ['word,', 1.5],
    ['word;', 1.5],
    ['word:', 1.5],
    ['word.', 2.5],
    ['word!', 2.5],
    ['word?', 2.5],
  ])('%j gets the right multiplier', (chunk, mult) => {
    const expected = Math.round((60000 / 250) * mult);
    expect(pauseCalculator(chunk as string, 250)).toBe(expected);
  });

  it('paragraph break marker gets ×3', () => {
    expect(pauseCalculator('word\n', 250)).toBe(Math.round(BASE_AT_250 * 3));
  });

  it('only the FINAL character of the chunk decides the pause', () => {
    // Comma mid-chunk is irrelevant; the period at the end governs.
    expect(pauseCalculator('quick, brown fox.', 250)).toBe(
      Math.round(BASE_AT_250 * 2.5),
    );
  });
});

describe('pauseCalculator — output invariants', () => {
  it('always returns a positive integer', () => {
    for (const wpm of [150, 250, 333, 800]) {
      for (const chunk of ['a', 'b.', 'c,', 'd\n', 'e!']) {
        const ms = pauseCalculator(chunk, wpm);
        expect(Number.isInteger(ms)).toBe(true);
        expect(ms).toBeGreaterThan(0);
      }
    }
  });

  it('handles empty chunk defensively with the base interval', () => {
    expect(pauseCalculator('', 250)).toBe(Math.round(BASE_AT_250));
  });
});
