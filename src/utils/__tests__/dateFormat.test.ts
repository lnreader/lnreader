import { formatDate, getDateFormatLabel } from '../dateFormat';

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
});
