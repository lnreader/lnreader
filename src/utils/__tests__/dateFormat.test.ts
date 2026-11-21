import {
  createDateFormatter,
  DATE_FORMATS,
  formatDate,
  getDateFormatLabel,
} from '../dateFormat';

describe('dateFormat', () => {
  const now = new Date(2026, 6, 25, 12);

  it.each([
    ['MM/DD/YY', '07/25/26'],
    ['DD/MM/YY', '25/07/26'],
    ['YYYY-MM-DD', '2026-07-25'],
    ['DD MMM YYYY', '25 Jul 2026'],
    ['MMM DD, YYYY', 'Jul 25, 2026'],
  ] as const)('formats %s dates', (dateFormat, expected) => {
    expect(formatDate(now, dateFormat, false)).toBe(expected);
  });

  it('uses relative labels only when enabled', () => {
    expect(formatDate(now, 'YYYY-MM-DD', true, now)).toBe('Today');
    expect(formatDate(new Date(2026, 6, 24, 12), 'YYYY-MM-DD', true, now)).toBe(
      'Yesterday',
    );
    expect(formatDate(now, 'YYYY-MM-DD', false, now)).toBe('2026-07-25');
  });

  it('keeps calendar labels for dates within a week', () => {
    expect(formatDate(new Date(2026, 6, 20, 12), 'YYYY-MM-DD', true, now)).toBe(
      'Last Monday',
    );
  });

  it('includes a preview in each setting label', () => {
    expect(getDateFormatLabel('DD/MM/YY', now)).toBe('dd/MM/yy (25/07/26)');
    expect(getDateFormatLabel('default', now)).toContain('Default (');
  });

  it('preserves invalid string values', () => {
    expect(formatDate('Unknown', 'YYYY-MM-DD')).toBe('Unknown');
  });

  describe('createDateFormatter', () => {
    const values = [
      now,
      new Date(2026, 6, 24, 23, 59),
      new Date(2026, 6, 19, 0, 1),
      new Date(2026, 6, 18, 12),
      new Date(2026, 7, 1, 12),
      new Date(2026, 7, 2, 12),
      '2026-07-25',
      '2026-01-01T10:00:00.000Z',
      'Unknown',
    ];

    it.each(
      DATE_FORMATS.flatMap(f => [[f, true] as const, [f, false] as const]),
    )('matches formatDate for %s (relative: %s)', (dateFormat, relative) => {
      const format = createDateFormatter(dateFormat, relative, now);
      for (const value of values) {
        expect(format(value)).toBe(
          formatDate(value, dateFormat, relative, now),
        );
      }
    });

    it('returns cached results for repeated values', () => {
      const format = createDateFormatter('YYYY-MM-DD', false, now);
      expect(format('2026-01-01')).toBe('2026-01-01');
      expect(format('2026-01-01')).toBe('2026-01-01');
    });
  });
});
