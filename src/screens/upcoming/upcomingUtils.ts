import type { UpcomingNovel } from '@database/queries/LibraryQueries';
import {
  type Day,
  dayFromYmd,
  dayOfWeek,
  parseStoredDay,
  ymd,
} from '@services/updates/releaseSchedule';

export type UpcomingRow =
  | { type: 'header'; key: string; day: Day; count: number }
  | { type: 'novel'; key: string; day: Day; novel: UpcomingNovel };

export interface UpcomingData {
  rows: UpcomingRow[];
  /** Index in [rows] of each day's header. */
  headerIndexByDay: Map<Day, number>;
  countByDay: Map<Day, number>;
}

/** Rows for the list: a header per predicted day, then that day's novels. */
export const groupUpcoming = (novels: UpcomingNovel[]): UpcomingData => {
  const rows: UpcomingRow[] = [];
  const headerIndexByDay = new Map<Day, number>();
  const countByDay = new Map<Day, number>();

  for (const novel of novels) {
    const day = parseStoredDay(novel.nextUpdate);
    if (day === undefined) continue;
    let headerIndex = headerIndexByDay.get(day);
    if (headerIndex === undefined) {
      headerIndex = rows.length;
      headerIndexByDay.set(day, headerIndex);
      rows.push({ type: 'header', key: `header-${day}`, day, count: 0 });
    }
    const header = rows[headerIndex];
    if (header.type === 'header') header.count += 1;
    countByDay.set(day, (countByDay.get(day) ?? 0) + 1);
    rows.push({ type: 'novel', key: `novel-${novel.id}`, day, novel });
  }

  return { rows, headerIndexByDay, countByDay };
};

export const firstOfMonth = (day: Day) => {
  const { year, month } = ymd(day);
  return dayFromYmd(year, month, 1);
};

export const addMonths = (first: Day, months: number) => {
  const { year, month } = ymd(first);
  return dayFromYmd(year, month + months, 1);
};

/**
 * The weeks of the month starting on [first], each 7 cells long, with null
 * for the days outside the month. [weekStart] is 0 for Sunday … 6 for Saturday.
 */
export const monthWeeks = (first: Day, weekStart: number): (Day | null)[][] => {
  const daysInMonth = addMonths(first, 1) - first;
  const leading = ((((dayOfWeek(first) % 7) - weekStart) % 7) + 7) % 7;
  const cells: (Day | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => first + i),
  ];
  while (cells.length % 7) cells.push(null);

  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
};
