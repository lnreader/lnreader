import dayjs from 'dayjs';
import {
  type ChapterDates,
  type Day,
  computeNovelSchedule,
  dayOfWeek,
  estimateSchedule,
  formatDay,
  isDueForUpdate,
  parseDay,
  shouldRecomputeSchedule,
  startOfLocalDay,
  toLocalDay,
} from '../releaseSchedule';

// Scenarios ported from Mihon's FetchIntervalTest.

const testTime = dayjs('2020-01-01T00:00:00');

const atHours = (hours: number): ChapterDates => {
  const time = testTime.add(hours, 'hour').format('YYYY-MM-DDTHH:mm:ss');
  return { releaseTime: time, updatedTime: time };
};
const afterDays = (days: number) => atHours(days * 24);

const chaptersOn = (days: Day[], perDay = 1): ChapterDates[] =>
  days.flatMap(day =>
    Array.from({ length: perDay }, () => ({
      releaseTime: formatDay(day),
      updatedTime: `${formatDay(day)}T12:00:00`,
    })),
  );

const every = (days: number, from: string, to: string): Day[] => {
  const result: Day[] = [];
  for (let day = parseDay(from); day <= parseDay(to); day += days) {
    result.push(day);
  }
  return result;
};
const weekly = (from: string, to: string) => every(7, from, to);
const afterGaps = (from: string, ...gaps: number[]) =>
  gaps.reduce(
    (days, gap) => [...days, days[days.length - 1] + gap],
    [parseDay(from)],
  );
const days = (...values: string[]) => values.map(parseDay);

const interval = (chapters: ChapterDates[]) =>
  estimateSchedule(chapters, toLocalDay(new Date())).interval;

const expecting = (day: string) => ({
  fetchInterval: 0,
  nextUpdate: startOfLocalDay(parseDay(day)).toISOString(),
});

const nextUpdate = (
  today: string,
  chapters: ChapterDates[],
  novel: {
    fetchInterval: number;
    nextUpdate: string | null;
  } = { fetchInterval: 0, nextUpdate: null },
  foundRelease = false,
) =>
  formatDay(
    computeNovelSchedule(novel, chapters, parseDay(today), foundRelease)
      .nextUpdate,
  );

describe('estimateSchedule interval', () => {
  it('returns default interval of 7 days when not enough distinct days', () => {
    const withReleaseTime = Array.from({ length: 50 }, () => afterDays(1));
    expect(interval(withReleaseTime)).toBe(7);
    expect(
      interval(withReleaseTime.map(c => ({ ...c, releaseTime: null }))),
    ).toBe(7);
  });

  it('returns interval based on more recent chapters', () => {
    const old = [1, 2, 3, 4, 5].map(n => afterDays(n * 7));
    const recent = Array.from({ length: 10 }, (_, i) => afterDays(35 + i + 1));
    expect(interval([...old, ...recent])).toBe(1);
  });

  it('returns interval based on smaller subset of recent chapters if very few chapters', () => {
    const old = [1, 2, 3].map(n => afterDays(n * 7));
    const recent = [1, 2, 3].map(n => afterDays(21 + 365 + n * 7));
    expect(interval([...old, ...recent])).toBe(7);
  });

  it('returns interval of 7 days when multiple chapters in 1 day', () => {
    expect(interval(Array.from({ length: 10 }, () => atHours(10)))).toBe(7);
  });

  it('returns interval of 7 days when multiple chapters in 2 days', () => {
    expect(
      interval([
        afterDays(1),
        afterDays(1),
        ...Array.from({ length: 5 }, () => afterDays(2)),
      ]),
    ).toBe(7);
  });

  it('returns interval of 1 day when chapters are released every 1 day', () => {
    expect(
      interval(Array.from({ length: 20 }, (_, i) => afterDays(i + 1))),
    ).toBe(1);
  });

  it('returns interval of 1 day when delta is less than 1 day', () => {
    expect(
      interval(Array.from({ length: 20 }, (_, i) => atHours(15 * (i + 1)))),
    ).toBe(1);
  });

  it('returns interval of 2 days when chapters are released every 2 days', () => {
    expect(
      interval(Array.from({ length: 20 }, (_, i) => afterDays(2 * (i + 1)))),
    ).toBe(2);
  });

  it('returns interval with floored value when interval is decimal', () => {
    const chapters = [1, 2, 3, 4, 5].map(n => atHours(25 * n));
    expect(interval(chapters)).toBe(1);
    expect(interval(chapters.map(c => ({ ...c, releaseTime: null })))).toBe(1);
  });

  it('returns interval of 2 days when chapters are released just below every 2 days', () => {
    expect(
      interval(Array.from({ length: 20 }, (_, i) => atHours(43 * (i + 1)))),
    ).toBe(2);
  });

  it('ignores release times that break the plugin date contract', () => {
    const chapters = Array.from({ length: 20 }, (_, i) => ({
      ...afterDays(2 * (i + 1)),
      releaseTime: `${i + 1} days ago`,
    }));
    expect(interval(chapters)).toBe(2);
  });
});

describe('computeNovelSchedule', () => {
  it('follows releases on a few fixed weekdays', () => {
    const mondaysAndThursdays = every(1, '2019-12-02', '2020-01-20').filter(
      day => dayOfWeek(day) === 1 || dayOfWeek(day) === 4,
    );
    const chapters = chaptersOn(mondaysAndThursdays);

    expect(estimateSchedule(chapters, parseDay('2020-01-21')).pattern).toEqual({
      kind: 'weekdays',
      days: [1, 4],
    });
    expect(nextUpdate('2020-01-21', chapters)).toBe('2020-01-23');
  });

  it('follows releases on a day of the month', () => {
    const chapters = chaptersOn(
      days(
        '2019-09-15',
        '2019-10-15',
        '2019-11-14',
        '2019-12-15',
        '2020-01-16',
      ),
      2,
    );
    expect(nextUpdate('2020-01-20', chapters)).toBe('2020-02-15');
  });

  it('follows releases on the last day of the month', () => {
    const chapters = chaptersOn(
      days(
        '2019-09-30',
        '2019-10-31',
        '2019-11-30',
        '2019-12-31',
        '2020-01-31',
      ),
      2,
    );
    expect(nextUpdate('2020-02-05', chapters)).toBe('2020-02-29');
  });

  it('follows releases on two days of the month', () => {
    const chapters = chaptersOn(
      days(
        '2019-10-01',
        '2019-10-15',
        '2019-11-01',
        '2019-11-16',
        '2019-12-01',
        '2019-12-15',
        '2020-01-01',
        '2020-01-15',
      ),
      2,
    );

    expect(estimateSchedule(chapters, parseDay('2020-01-20')).pattern).toEqual({
      kind: 'daysOfMonth',
      days: [1, 15],
    });
    expect(nextUpdate('2020-01-20', chapters)).toBe('2020-02-01');
  });

  it('follows releases on a weekday of the month', () => {
    const chapters = chaptersOn(
      days(
        '2019-09-07',
        '2019-10-05',
        '2019-11-02',
        '2019-12-07',
        '2020-01-04',
      ),
      2,
    );
    expect(nextUpdate('2020-01-10', chapters)).toBe('2020-02-01');
  });

  it('follows releases on a weekday of the last week of the month', () => {
    const chapters = chaptersOn(
      days(
        '2019-09-27',
        '2019-10-25',
        '2019-11-29',
        '2019-12-27',
        '2020-01-31',
      ),
      2,
    );
    expect(nextUpdate('2020-02-03', chapters)).toBe('2020-02-28');
  });

  it('follows releases in batches', () => {
    // Three days of releases every three weeks
    const batches = every(21, '2019-09-02', '2019-12-16').flatMap(start => [
      start,
      start + 1,
      start + 2,
    ]);
    const chapters = chaptersOn(
      batches.filter(day => day <= parseDay('2019-12-17')),
    );

    expect(nextUpdate('2019-12-17', chapters, undefined, true)).toBe(
      '2019-12-18',
    );
    expect(nextUpdate('2019-12-18', chaptersOn(batches), undefined, true)).toBe(
      '2020-01-06',
    );
  });

  it('checks again around when an earlier break ended', () => {
    // A season of weekly releases, a 98 day break, and another season
    const chapters = chaptersOn([
      ...weekly('2019-01-02', '2019-03-27'),
      ...weekly('2019-07-03', '2019-09-25'),
    ]);

    expect(nextUpdate('2019-12-20', chapters)).toBe('2019-12-25');
    expect(nextUpdate('2019-12-26', chapters)).toBe('2020-01-01');
  });

  it('never waits more than 28 days between checks', () => {
    const chapters = chaptersOn(
      days(
        '2019-09-30',
        '2019-10-31',
        '2019-11-30',
        '2019-12-31',
        '2020-01-31',
      ),
      2,
    );
    expect(nextUpdate('2020-01-31', chapters, undefined, true)).toBe(
      '2020-02-28',
    );
  });

  it('keeps checking on the expected day', () => {
    const chapters = chaptersOn(weekly('2019-12-04', '2019-12-25'));
    expect(nextUpdate('2020-01-01', chapters)).toBe('2020-01-01');
  });

  it('keeps a next update in the window while nothing new came out', () => {
    const chapters = chaptersOn(weekly('2019-12-04', '2019-12-25'));
    expect(nextUpdate('2020-01-02', chapters, expecting('2020-01-01'))).toBe(
      '2020-01-01',
    );
  });

  it('counts from a release on the expected day', () => {
    const chapters = chaptersOn(weekly('2019-12-04', '2020-01-01'));
    expect(nextUpdate('2020-01-01', chapters, expecting('2020-01-01'))).toBe(
      '2020-01-08',
    );
  });

  it('keeps the schedule for a release uploaded the day before it was found', () => {
    const chapters = chaptersOn([
      ...weekly('2019-10-02', '2019-12-25'),
      parseDay('2019-12-31'),
    ]);
    expect(
      nextUpdate('2020-01-01', chapters, expecting('2020-01-01'), true),
    ).toBe('2020-01-08');
  });

  it('keeps the schedule after a release shortly before the expected day', () => {
    const chapters = chaptersOn([
      ...weekly('2019-10-02', '2019-12-25'),
      parseDay('2019-12-30'),
    ]);
    expect(
      nextUpdate('2019-12-30', chapters, expecting('2020-01-01'), true),
    ).toBe('2020-01-08');
  });

  it('keeps the schedule after a late release', () => {
    const chapters = chaptersOn([
      ...weekly('2019-12-04', '2019-12-25'),
      parseDay('2020-01-03'),
    ]);
    expect(
      nextUpdate('2020-01-03', chapters, expecting('2020-01-01'), true),
    ).toBe('2020-01-08');
  });

  it('keeps expecting the release after an extra one well before it', () => {
    const chapters = chaptersOn([
      ...weekly('2019-10-02', '2020-01-01'),
      parseDay('2020-01-02'),
    ]);
    expect(
      nextUpdate('2020-01-02', chapters, expecting('2020-01-08'), true),
    ).toBe('2020-01-08');
  });

  it('follows the schedule again when releases resume after a hiatus', () => {
    const chapters = chaptersOn([
      ...weekly('2019-09-11', '2019-10-02'),
      parseDay('2020-01-01'),
    ]);
    expect(
      nextUpdate('2020-01-01', chapters, expecting('2020-01-22'), true),
    ).toBe('2020-01-08');
  });

  it('follows the schedule once releases keep coming early', () => {
    const chapters = chaptersOn([
      ...every(5, '2019-10-01', '2019-12-15'),
      ...every(5, '2019-12-19', '2019-12-29'),
    ]);
    expect(
      nextUpdate('2019-12-29', chapters, expecting('2019-12-30'), true),
    ).toBe('2020-01-03');
  });

  it('keeps checking for an overdue release while recent ones came that late', () => {
    const chapters = chaptersOn(
      afterGaps('2019-10-18', 6, 5, 8, 6, 5, 6, 8, 6, 5),
    );
    // Due on the 18th from a median gap of 6, and gaps have run to 8
    expect(nextUpdate('2019-12-20', chapters, expecting('2019-12-18'))).toBe(
      '2019-12-20',
    );
  });

  it('counts from an early release with a custom interval', () => {
    expect(
      nextUpdate(
        '2019-12-31',
        [],
        { ...expecting('2020-01-01'), fetchInterval: -7 },
        true,
      ),
    ).toBe('2020-01-07');
  });

  it('spreads out checks during a hiatus', () => {
    const chapters = chaptersOn(weekly('2019-09-11', '2019-10-02'));
    expect(nextUpdate('2020-01-01', chapters)).toBe('2020-01-22');
  });

  it('ignores chapters dated in the future', () => {
    const chapters = chaptersOn([
      ...weekly('2019-12-04', '2019-12-25'),
      parseDay('2020-06-01'),
    ]);
    expect(nextUpdate('2020-01-01', chapters)).toBe('2020-01-01');
  });
});

describe('library update window', () => {
  const today = parseDay('2020-01-10');
  const stored = (day: string) => startOfLocalDay(parseDay(day)).toISOString();

  it('checks novels due by tomorrow and novels without a prediction', () => {
    expect(isDueForUpdate(null, today)).toBe(true);
    expect(isDueForUpdate(stored('2020-01-05'), today)).toBe(true);
    expect(isDueForUpdate(stored('2020-01-11'), today)).toBe(true);
    expect(isDueForUpdate(stored('2020-01-12'), today)).toBe(false);
  });

  it('keeps a date in the window after a fetch that found nothing', () => {
    const noRelease = { foundRelease: false, manual: false };
    expect(
      shouldRecomputeSchedule(
        { fetchInterval: 7, nextUpdate: stored('2020-01-09') },
        today,
        noRelease,
      ),
    ).toBe(false);
    expect(
      shouldRecomputeSchedule(
        { fetchInterval: 7, nextUpdate: stored('2020-01-08') },
        today,
        noRelease,
      ),
    ).toBe(true);
    expect(
      shouldRecomputeSchedule(
        { fetchInterval: 0, nextUpdate: null },
        today,
        noRelease,
      ),
    ).toBe(true);
    expect(
      shouldRecomputeSchedule(
        { fetchInterval: 7, nextUpdate: stored('2020-01-09') },
        today,
        { foundRelease: false, manual: true },
      ),
    ).toBe(true);
  });
});
