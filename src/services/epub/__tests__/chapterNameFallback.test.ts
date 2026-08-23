/**
 * Chapter name-fallback unit tests (spec-1997 AC1, R1).
 *
 * Contract: the fallback must survive any path shape a chapter file can
 * arrive in — both separator styles — and still yield a speakable/usable
 * name when the segment is empty (trailing separator), rather than an
 * empty string.
 */

import { chapterNameFallback } from '../helpers';

describe('chapterNameFallback (spec-1997 AC1)', () => {
  it('returns the last path segment (unix separators)', () => {
    expect(chapterNameFallback('epub/OEBPS/chapter1.xhtml')).toBe(
      'chapter1.xhtml',
    );
  });

  it('returns the last path segment (windows separators)', () => {
    expect(chapterNameFallback('epub\\OEBPS\\chapter2.xhtml')).toBe(
      'chapter2.xhtml',
    );
  });

  it('handles mixed separators', () => {
    expect(chapterNameFallback('epub/OEBPS\\ch3.html')).toBe('ch3.html');
  });

  it("returns 'unknown' for a trailing separator (empty last segment)", () => {
    expect(chapterNameFallback('epub/OEBPS/')).toBe('unknown');
    expect(chapterNameFallback('epub\\OEBPS\\')).toBe('unknown');
  });

  it('returns the bare token when there is no separator', () => {
    expect(chapterNameFallback('chapter4.html')).toBe('chapter4.html');
  });
});
