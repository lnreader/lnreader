import dayjs from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import type { ChapterRow, ChapterRowFormat } from '@modules/nitro-chapter-list';
import type { ChapterInfo } from '@database/types';
import { getString, localization } from '@i18n/translations';
import type { DateFormat } from '@utils/dateFormat';

export interface ChapterRowSettings {
  showChapterTitles: boolean;
  dateFormat: DateFormat;
  relativeTimestamps: boolean;
}

/**
 * A chapter's raw row values. Native formats the text when the row is bound;
 * JS only parses the release time, with the same dayjs parsing `formatDate`
 * uses, because sources store it as free-form text.
 */
export const toChapterRow = (chapter: ChapterInfo): ChapterRow => {
  let releaseTime: number | undefined;
  let releaseText = '';
  if (chapter.releaseTime) {
    const date = dayjs(chapter.releaseTime);
    if (date.isValid()) {
      releaseTime = date.valueOf();
    } else {
      releaseText = chapter.releaseTime;
    }
  }
  return {
    id: chapter.id,
    name: chapter.name,
    numberText:
      chapter.chapterNumber === null || chapter.chapterNumber === undefined
        ? ''
        : String(chapter.chapterNumber),
    releaseTime,
    releaseText,
    scanlator: chapter.scanlator ?? '',
    progress: chapter.progress ?? 0,
    unread: !!chapter.unread,
    bookmarked: !!chapter.bookmark,
    downloaded: !!chapter.isDownloaded,
  };
};

dayjs.extend(calendar);

const DAYS_IN_WEEK = 7;

/**
 * Everything native needs to format rows exactly like `ChapterItem`:
 * translated templates, and the relative-date labels and month names produced
 * by the same dayjs calls `formatDate` makes. The labels depend only on the
 * weekday, so native can pick them for any "today".
 */
export const buildChapterRowFormat = ({
  showChapterTitles,
  dateFormat,
  relativeTimestamps,
}: ChapterRowSettings): ChapterRowFormat => {
  // Any day works; dayjs' calendar labels depend only on the day offset and
  // the weekday, never on the date or time.
  const reference = dayjs(new Date(2024, 0, 10, 12));
  const lastWeek: string[] = [];
  const nextWeek: string[] = [];
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const day = reference.add(i, 'day');
    lastWeek[day.day()] = day.calendar(day.add(3, 'day'));
    nextWeek[day.day()] = day.calendar(day.subtract(3, 'day'));
  }
  return {
    showChapterTitles,
    chapterTitleTemplate: getString('novelScreen.chapterChapnum', {
      num: '%{num}',
    }),
    progressTemplate: getString('novelScreen.progress', {
      progress: '%{progress}',
    }),
    dateFormat,
    relativeDates: relativeTimestamps,
    locale: localization,
    sameDay: reference.calendar(reference),
    lastDay: reference.subtract(1, 'day').calendar(reference),
    nextDay: reference.add(1, 'day').calendar(reference),
    lastWeek,
    nextWeek,
    monthsShort: Array.from({ length: 12 }, (_, month) =>
      dayjs(new Date(2024, month, 15)).format('MMM'),
    ),
  };
};

const sameRow = (a: ChapterRow, b: ChapterRow) =>
  a === b ||
  (a.id === b.id &&
    a.name === b.name &&
    a.numberText === b.numberText &&
    a.releaseTime === b.releaseTime &&
    a.releaseText === b.releaseText &&
    a.scanlator === b.scanlator &&
    a.progress === b.progress &&
    a.unread === b.unread &&
    a.bookmarked === b.bookmarked &&
    a.downloaded === b.downloaded);

/** What the native store currently holds, as last synced. */
export interface ChapterListSnapshot {
  /** Changes whenever the list is replaced (novel, page, sort, filter). */
  key: string;
  total: number;
  rows: readonly ChapterRow[];
}

export type ChapterListOp =
  | { type: 'reset'; total: number }
  | { type: 'setRows'; start: number; rows: ChapterRow[] }
  | { type: 'updateRows'; rows: ChapterRow[] }
  /**
   * Not a store call: native still shows rows `start..end-1` from before JS
   * reloaded a shorter prefix of the same list. They should be reloaded.
   */
  | { type: 'staleRows'; start: number; end: number };

/**
 * The fewest store calls that turn `prev` into `next`. Loaded rows are always a
 * prefix of the list, so a new batch is an append (`setRows`) and edits keep
 * positions (`updateRows`). Reloading a shorter prefix of the same list (the
 * novel store does this after downloads) keeps the rows native already shows
 * and reports them as `staleRows`, instead of blanking them. Anything else (a
 * new key, a new total, rows that moved) replaces the list.
 */
export const planChapterListSync = (
  prev: ChapterListSnapshot | null,
  next: ChapterListSnapshot,
): ChapterListOp[] => {
  const replace = (): ChapterListOp[] => {
    const ops: ChapterListOp[] = [{ type: 'reset', total: next.total }];
    if (next.rows.length > 0) {
      ops.push({ type: 'setRows', start: 0, rows: next.rows.slice() });
    }
    return ops;
  };

  if (!prev || prev.key !== next.key || prev.total !== next.total) {
    return replace();
  }

  const shared = Math.min(prev.rows.length, next.rows.length);
  const updated: ChapterRow[] = [];
  for (let i = 0; i < shared; i++) {
    const before = prev.rows[i];
    const after = next.rows[i];
    if (before === after) {
      continue;
    }
    if (before.id !== after.id) {
      return replace();
    }
    if (!sameRow(before, after)) {
      updated.push(after);
    }
  }

  const ops: ChapterListOp[] = [];
  if (updated.length > 0) {
    ops.push({ type: 'updateRows', rows: updated });
  }
  if (next.rows.length > prev.rows.length) {
    ops.push({
      type: 'setRows',
      start: prev.rows.length,
      rows: next.rows.slice(prev.rows.length),
    });
  } else if (next.rows.length < prev.rows.length) {
    ops.push({
      type: 'staleRows',
      start: next.rows.length,
      end: prev.rows.length,
    });
  }
  return ops;
};

/** True when both sets hold the same ids. */
export const sameIdSet = (
  a: ReadonlySet<number> | null,
  b: ReadonlySet<number>,
) => {
  if (!a || a.size !== b.size) {
    return false;
  }
  for (const id of b) {
    if (!a.has(id)) {
      return false;
    }
  }
  return true;
};
