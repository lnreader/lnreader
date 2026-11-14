import { filterChapterText } from '../filterChapterText';

describe('filterChapterText', () => {
  it('removes every literal match while preserving chapter markup and attributes', () => {
    expect(
      filterChapterText('<p>Ad.* Story Ad.*</p><img src="Ad.*.png">', ['Ad.*']),
    ).toBe('<p> Story </p><img src="Ad.*.png">');
  });

  it('matches decoded entities and keeps matching case sensitive', () => {
    expect(filterChapterText('<p>A &amp; B a &amp; b</p>', ['A & B'])).toBe(
      '<p> a &amp; b</p>',
    );
  });

  it('ignores blank filters and leaves the original chapter unchanged without filters', () => {
    const html = '<p>Original chapter</p>';
    expect(filterChapterText(html, ['', '  '])).toBe(html);
    expect(filterChapterText(html, [])).toBe(html);
  });
});
