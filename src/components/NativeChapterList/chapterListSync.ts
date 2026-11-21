import type { ChapterRow } from '@modules/nitro-chapter-list';
import type { ChapterInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { createDateFormatter, DateFormat } from '@utils/dateFormat';

export interface ChapterRowFormat {
  showChapterTitles: boolean;
  dateFormat: DateFormat;
  relativeTimestamps: boolean;
}

/** Builds the strings `ChapterItem` renders, so native rows only bind them. */
export const buildChapterRow = (
  chapter: ChapterInfo,
  format: ChapterRowFormat,
  // Share one across a batch: it caches and fixes "now" once.
  formatReleaseDate: (value: string) => string = createDateFormatter(
    format.dateFormat,
    format.relativeTimestamps,
  ),
): ChapterRow => {
  const { releaseTime, scanlator, progress, unread } = chapter;
  const parts: string[] = [];
  if (releaseTime) {
    parts.push(formatReleaseDate(releaseTime));
  }
  if (scanlator) {
    parts.push(scanlator);
  }
  if (progress && progress > 0 && unread) {
    parts.push(getString('novelScreen.progress', { progress }));
  }
  return {
    id: chapter.id,
    title: format.showChapterTitles
      ? chapter.name
      : getString('novelScreen.chapterChapnum', {
          num: chapter.chapterNumber,
        }),
    subtitle: parts.join(' •  '),
    unread: !!unread,
    bookmarked: !!chapter.bookmark,
    downloaded: !!chapter.isDownloaded,
  };
};

const sameRow = (a: ChapterRow, b: ChapterRow) =>
  a === b ||
  (a.id === b.id &&
    a.title === b.title &&
    a.subtitle === b.subtitle &&
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
