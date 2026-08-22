import { useCallback, useMemo } from 'react';

import {
  deleteChapters,
  getNovelDownloadedChapters,
} from '@database/queries/ChapterQueries';
import { deleteNovelHistory } from '@database/queries/HistoryQueries';
import { removeNovelsFromLibrary } from '@database/queries/NovelQueries';
import { useDownload } from '@hooks/persisted';
import { History } from '@database/types';
import { backgroundTasks } from '@services/backgroundTasks';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';

export interface PurgeFailure {
  novelId: number;
  novelName: string;
  error: string;
}

export interface PurgeResult {
  purgedNovels: number;
  failures: PurgeFailure[];
  /** Novels whose queued downloads could not be attributed (legacy tasks). */
  unmatchedQueuedNovelIds: number[];
}

export interface OrchestrationEntry {
  novelId: number;
  pluginId: string;
  inLibrary: boolean | null;
  novelName: string;
}

/**
 * Pure orchestration for the History bulk purge (#1874), extracted so the
 * order of operations is unit-testable without React (review round 1:
 * the purge's correctness IS its order of operations).
 *
 * Contract (spec-1874 rulings round 1, c8a1b11):
 *   1. cancel queued downloads per-novel BEFORE any deletion
 *   2. per-novel error isolation — one failure never aborts the rest
 *   3. history clear always runs; library removal only when inLibrary
 */
export const runPurgeOrchestration = async (
  entries: OrchestrationEntry[],
  io: {
    cancelForNovels: (novelIds: number[]) => Promise<number[]>;
    getDownloadedChapters: (novelId: number) => Promise<{ id: number }[]>;
    deleteChaptersFiles: (
      pluginId: string,
      novelId: number,
      chapterIds: number[],
    ) => Promise<void>;
    deleteHistory: (novelId: number) => Promise<void>;
    removeFromLibrary: (novelIds: number[]) => Promise<void>;
  },
): Promise<PurgeResult> => {
  const uniqueEntries = new Map<number, OrchestrationEntry>();
  for (const entry of entries) {
    if (!uniqueEntries.has(entry.novelId)) {
      uniqueEntries.set(entry.novelId, entry);
    }
  }

  const failures: PurgeFailure[] = [];

  const unattributable = await io.cancelForNovels([...uniqueEntries.keys()]);

  for (const entry of uniqueEntries.values()) {
    try {
      const downloaded = await io.getDownloadedChapters(entry.novelId);
      if (downloaded.length) {
        await io.deleteChaptersFiles(
          entry.pluginId,
          entry.novelId,
          downloaded.map(chapter => chapter.id),
        );
      }
      await io.deleteHistory(entry.novelId);
    } catch (error) {
      failures.push({
        novelId: entry.novelId,
        novelName: entry.novelName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const libraryIds = [...uniqueEntries.values()]
    .filter(
      entry =>
        entry.inLibrary && !failures.some(f => f.novelId === entry.novelId),
    )
    .map(entry => entry.novelId);

  if (libraryIds.length) {
    try {
      await io.removeFromLibrary(libraryIds);
    } catch (error) {
      failures.push({
        novelId: -1,
        novelName: '(library removal)',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    purgedNovels: uniqueEntries.size - failures.length,
    failures,
    unmatchedQueuedNovelIds: unattributable.filter(
      id => !failures.some(failure => failure.novelId === id),
    ),
  };
};

/**
 * Bulk-purge helper for the History screen (#1874): for every selected
 * history entry, cancel that novel's queued chapter downloads, wipe
 * downloaded files, clear its read history, and remove it from Library when
 * it belongs there. Non-library entries are handled gracefully (history +
 * files only). Per-novel errors are isolated and surfaced to the caller.
 */
export const useHistoryPurge = () => {
  const { downloadQueue } = useDownload();

  const downloadingNovelIds = useMemo(
    () =>
      new Set(
        downloadQueue.flatMap(item =>
          item.task.data.novelId === undefined ? [] : [item.task.data.novelId],
        ),
      ),
    [downloadQueue],
  );

  const purgeNovels = useCallback(
    async (entries: History[]): Promise<PurgeResult> => {
      const uniqueEntries = new Map<number, History>();
      for (const entry of entries) {
        if (!uniqueEntries.has(entry.novelId)) {
          uniqueEntries.set(entry.novelId, entry);
        }
      }

      // Cancel only the selected novels' queued downloads before deleting.
      const touchesSelection = [...uniqueEntries.values()].some(entry =>
        downloadingNovelIds.has(entry.novelId),
      );
      let unmatchedQueuedNovelIds: number[] = [];
      if (touchesSelection) {
        unmatchedQueuedNovelIds = await backgroundTasks.cancelForNovels([
          ...uniqueEntries.keys(),
        ]);
        if (unmatchedQueuedNovelIds.length) {
          showToast(
            getString('historyScreen.unattributableDownloads', {
              count: unmatchedQueuedNovelIds.length,
            }),
          );
        }
      }

      const libraryNovelIds: number[] = [];
      const failures: PurgeFailure[] = [];

      for (const entry of uniqueEntries.values()) {
        try {
          const downloaded = await getNovelDownloadedChapters(entry.novelId);
          if (downloaded.length) {
            await deleteChapters(
              entry.pluginId,
              entry.novelId,
              downloaded.map(chapter => chapter.id),
            );
          }
          await deleteNovelHistory(entry.novelId);
          if (entry.inLibrary) {
            libraryNovelIds.push(entry.novelId);
          }
        } catch (error) {
          // Per-novel error isolation (#1874 review R4): one broken entry
          // must not abort the purge of the rest.
          failures.push({
            novelId: entry.novelId,
            novelName: entry.novelName,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (libraryNovelIds.length) {
        try {
          await removeNovelsFromLibrary(libraryNovelIds);
        } catch (error) {
          failures.push({
            novelId: -1,
            novelName: '(library removal)',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return {
        purgedNovels: uniqueEntries.size - failures.length,
        failures,
        unmatchedQueuedNovelIds,
      };
    },
    [downloadingNovelIds],
  );

  return { purgeNovels };
};
