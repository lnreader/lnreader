/**
 * RED 1 — decodePath unit tests (spec-1997 AC1, R1).
 *
 * Contract (extracted from import.ts's inline helper):
 * - URI-encoded input decodes (decodeURI semantics).
 * - Malformed % sequences pass through unchanged (no throw).
 * - Plain paths pass through untouched.
 *
 * These tests import from '../helpers', which does not exist yet —
 * documented red.
 */

import { decodePath } from '../helpers';

describe('decodePath (spec-1997 AC1)', () => {
  it('decodes URI-encoded paths (space escapes)', () => {
    expect(decodePath('images%20sub%20dir/pic.png')).toBe(
      'images sub dir/pic.png',
    );
    // decodeURI semantics: reserved characters like %2F are preserved.
    expect(decodePath('epub%3Achapter1.html')).toBe('epub%3Achapter1.html');
  });

  it('passes plain paths through untouched', () => {
    expect(decodePath('epub/chapter1.html')).toBe('epub/chapter1.html');
    expect(decodePath('img/p_01.png')).toBe('img/p_01.png');
  });

  it('returns malformed % sequences unchanged instead of throwing', () => {
    expect(decodePath('bad/%E0%A4%A')).toBe('bad/%E0%A4%A');
    expect(decodePath('%zz')).toBe('%zz');
    expect(decodePath('100% done')).toBe('100% done');
  });

  it('handles empty string', () => {
    expect(decodePath('')).toBe('');
  });
});
