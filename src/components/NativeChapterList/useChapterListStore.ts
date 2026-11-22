import { useLayoutEffect, useRef, useState } from 'react';
import {
  createChapterListStore,
  type ChapterListStore,
  type ChapterRow,
} from '@modules/nitro-chapter-list';
import type { ChapterInfo } from '@database/types';
import {
  type ChapterListSnapshot,
  planChapterListSync,
  sameIdSet,
  toChapterRow,
} from './chapterListSync';

interface UseChapterListStoreOptions {
  /** Loaded chapters: always the first `chapters.length` positions of the list. */
  chapters: readonly ChapterInfo[];
  /** Filtered total, including chapters that aren't loaded yet. */
  totalChapters: number;
  /** Changes whenever the list is replaced (novel, page, sort, filter). */
  dataKey: string;
  selectedIds?: ReadonlySet<number>;
  downloadingIds: ReadonlySet<number>;
  /** The highlighted chapter (the reader drawer's current one); none when undefined. */
  highlightedId?: number;
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
  selectedIds,
  downloadingIds,
  highlightedId,
  onStaleRows,
}: UseChapterListStoreOptions): string => {
  const [store] = useState<ChapterListStore>(createChapterListStore);
  const snapshot = useRef<ChapterListSnapshot | null>(null);
  // Chapters are replaced, never mutated, so unchanged ones keep their row and
  // the diff below is mostly reference checks. Rows hold raw values (native
  // formats them), so display settings never invalidate this.
  const rowCache = useRef(new WeakMap<ChapterInfo, ChapterRow>());
  const synced = useRef({
    selected: null as ReadonlySet<number> | null,
    downloading: null as ReadonlySet<number> | null,
    highlighted: undefined as number | undefined,
  });

  const onStaleRowsRef = useRef(onStaleRows);
  useLayoutEffect(() => {
    onStaleRowsRef.current = onStaleRows;
  });

  useLayoutEffect(() => {
    const startedAt = performance.now();
    let built = 0;
    const cache = rowCache.current;
    const rows = chapters.map(chapter => {
      let row = cache.get(chapter);
      if (!row) {
        row = toChapterRow(chapter);
        built++;
        cache.set(chapter, row);
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
    if (built > 0) {
      // Shows up in the RN DevTools performance panel and in Perfetto traces.
      // Optional: some runtimes (and Jest) only provide performance.now.
      performance.measure?.(`LNChapterList: build ${built} rows + sync`, {
        start: startedAt,
        end: performance.now(),
      });
    }
  }, [store, chapters, totalChapters, dataKey]);

  useLayoutEffect(() => {
    if (selectedIds && !sameIdSet(synced.current.selected, selectedIds)) {
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

  useLayoutEffect(() => {
    if (synced.current.highlighted !== highlightedId) {
      synced.current.highlighted = highlightedId;
      store.setHighlighted(highlightedId);
    }
  }, [store, highlightedId]);

  return store.id;
};
