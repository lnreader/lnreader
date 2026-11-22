import { useCallback, useEffect, useRef } from 'react';
import { CHAPTER_BATCH_SIZE } from '@hooks/persisted/useNovel/types';
import { showToast } from '@utils/showToast';

interface UseChapterBatchRequestsOptions {
  /** Changes whenever the chapter list is replaced (novel, page, sort, filter). */
  chapterSetKey: string;
  fetching: boolean;
  /** The last batch the novel store has loaded (`batchInformation.batch`). */
  loadedBatch: number;
  loadUpToBatch: (batch: number) => Promise<void>;
}

/**
 * Answers a native chapter list's `onRequestRange` (and `onStaleRows`) with
 * `loadUpToBatch`. Returns `requestUpTo(index)`, which loads every batch up to
 * the one holding `index`.
 */
export const useChapterBatchRequests = ({
  chapterSetKey,
  fetching,
  loadedBatch,
  loadUpToBatch,
}: UseChapterBatchRequestsOptions) => {
  // The furthest batch the native list has needed for this chapter set.
  // Reloads (e.g. getChapters on refresh) drop back to the first batch
  // and cancel in-flight loads, so it's requested again until it's loaded.
  const neededBatch = useRef({ key: chapterSetKey, batch: -1 });
  // A failed batch read is reported; the native list asks for the batch again
  // when its placeholders bind after a few seconds (scrolling back to them).
  const loadBatch = useCallback(
    (batch: number) =>
      loadUpToBatch(batch).catch((error: unknown) =>
        showToast(error instanceof Error ? error.message : String(error)),
      ),
    [loadUpToBatch],
  );
  const requestUpTo = useCallback(
    (index: number) => {
      const needed = neededBatch.current;
      if (needed.key !== chapterSetKey) {
        needed.key = chapterSetKey;
        needed.batch = -1;
      }
      const batch = Math.floor(index / CHAPTER_BATCH_SIZE);
      needed.batch = Math.max(needed.batch, batch);
      loadBatch(batch);
    },
    [chapterSetKey, loadBatch],
  );

  useEffect(() => {
    const needed = neededBatch.current;
    if (
      !fetching &&
      needed.key === chapterSetKey &&
      needed.batch > loadedBatch
    ) {
      loadBatch(needed.batch);
    }
  }, [chapterSetKey, fetching, loadedBatch, loadBatch]);

  return requestUpTo;
};
