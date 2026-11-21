import { useLayoutEffect, useRef, useState } from 'react';
import {
  createChapterListStore,
  type ChapterListStore,
  type ChapterRow,
} from '@modules/nitro-chapter-list';
import type { ChapterInfo } from '@database/types';
import {
  buildChapterRow,
  type ChapterListSnapshot,
  type ChapterRowFormat,
  planChapterListSync,
  sameIdSet,
} from './chapterListSync';

interface UseChapterListStoreOptions {
  /** Loaded chapters: always the first `chapters.length` positions of the list. */
  chapters: readonly ChapterInfo[];
  /** Filtered total, including chapters that aren't loaded yet. */
  totalChapters: number;
  /** Changes whenever the list is replaced (novel, page, sort, filter). */
  dataKey: string;
  format: ChapterRowFormat;
  selectedIds: ReadonlySet<number>;
  downloadingIds: ReadonlySet<number>;
  /**
   * Native kept showing rows `start..end-1` after JS reloaded a shorter prefix
   * of the same list; load them again so they're current.
   */
  onStaleRows?: (start: number, end: number) => void;
}

/**
 * Creates a native chapter store and keeps it in sync with the novel store using
 * the fewest calls: appended batches become one `setRows`, edits one
 * `updateRows`. Returns the store id for `<NativeChapterList storeId>`.
 */
export const useChapterListStore = ({
  chapters,
  totalChapters,
  dataKey,
  format,
  selectedIds,
  downloadingIds,
  onStaleRows,
}: UseChapterListStoreOptions): string => {
  const [store] = useState<ChapterListStore>(createChapterListStore);
  const snapshot = useRef<ChapterListSnapshot | null>(null);
  // Chapters are replaced, never mutated, so unchanged ones keep their row and
  // the diff below is mostly reference checks.
  const rowCache = useRef({
    format: null as ChapterRowFormat | null,
    rows: new WeakMap<ChapterInfo, ChapterRow>(),
  });
  const synced = useRef({
    selected: null as ReadonlySet<number> | null,
    downloading: null as ReadonlySet<number> | null,
  });

  const { showChapterTitles, dateFormat, relativeTimestamps } = format;
  const onStaleRowsRef = useRef(onStaleRows);
  useLayoutEffect(() => {
    onStaleRowsRef.current = onStaleRows;
  });

  useLayoutEffect(() => {
    const cache = rowCache.current;
    let rowFormat = cache.format;
    if (
      !rowFormat ||
      rowFormat.showChapterTitles !== showChapterTitles ||
      rowFormat.dateFormat !== dateFormat ||
      rowFormat.relativeTimestamps !== relativeTimestamps
    ) {
      rowFormat = { showChapterTitles, dateFormat, relativeTimestamps };
      cache.format = rowFormat;
      cache.rows = new WeakMap();
    }
    const activeFormat = rowFormat;
    const rows = chapters.map(chapter => {
      let row = cache.rows.get(chapter);
      if (!row) {
        row = buildChapterRow(chapter, activeFormat);
        cache.rows.set(chapter, row);
      }
      return row;
    });
    const next: ChapterListSnapshot = {
      key: dataKey,
      total: Math.max(totalChapters, rows.length),
      rows,
    };
    for (const op of planChapterListSync(snapshot.current, next)) {
      switch (op.type) {
        case 'reset':
          store.reset(op.total);
          break;
        case 'setRows':
          store.setRows(op.start, op.rows);
          break;
        case 'updateRows':
          store.updateRows(op.rows);
          break;
        case 'staleRows':
          onStaleRowsRef.current?.(op.start, op.end);
          break;
      }
    }
    snapshot.current = next;
  }, [
    store,
    chapters,
    totalChapters,
    dataKey,
    showChapterTitles,
    dateFormat,
    relativeTimestamps,
  ]);

  useLayoutEffect(() => {
    if (!sameIdSet(synced.current.selected, selectedIds)) {
      synced.current.selected = selectedIds;
      store.setSelected(Array.from(selectedIds));
    }
  }, [store, selectedIds]);

  useLayoutEffect(() => {
    if (!sameIdSet(synced.current.downloading, downloadingIds)) {
      synced.current.downloading = downloadingIds;
      store.setDownloading(Array.from(downloadingIds));
    }
  }, [store, downloadingIds]);

  return store.id;
};
