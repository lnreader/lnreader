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
  /** Novels whose purge completed through every stage, history included. */
  purgedNovels: number;
  failures: PurgeFailure[];
  /**
   * Count of legacy (novelId-less) queued download tasks encountered while
   * cancelling: left running by design, surfaced via toast instead. A count
   * cannot be attributed to specific novels, so no synthetic ids are
   * fabricated here — unlike library-stage failures, which ARE attributable
   * and land in `failures` per novel.
   */
  legacyTaskCount: number;
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
 * Contract (round-2 AMENDED ruling — grillmaster, delivered by SRAL):
 *   1. cancel queued downloads per-novel BEFORE any deletion
 *      (io.cancelForNovels returns the count of unattributable legacy
 *      tasks it deliberately left running)
 *   2. per-novel error isolation — one failure never aborts the rest
 *   3. batched library removal AFTER the loop, BEFORE any history clear
 *   4. history clear LAST — the irreversible step runs only for novels
 *      whose purge reached this stage successfully; a library-stage
 *      failure leaves those histories intact (the atomicity property)
 */
export const runPurgeOrchestration = async (
  entries: OrchestrationEntry[],
  io: {
    cancelForNovels: (novelIds: number[]) => Promise<number>;
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

  // Stage 1: scoped cancel BEFORE any deletion; the returned number counts
  // legacy tasks (no novelId) that were deliberately left running.
  const legacyTaskCount = await io.cancelForNovels([...uniqueEntries.keys()]);

  // Stage 2: per-novel probe + file wipe, errors isolated per novel.
  const filesCleared: OrchestrationEntry[] = [];
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
      filesCleared.push(entry);
    } catch (error) {
      failures.push({
        novelId: entry.novelId,
        novelName: entry.novelName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Stage 3: ONE batched library write, only for novels still alive.
  const libraryIds = filesCleared
    .filter(entry => entry.inLibrary)
    .map(entry => entry.novelId);

  let libraryStageSucceeded = true;
  if (libraryIds.length) {
    try {
      await io.removeFromLibrary(libraryIds);
    } catch (error) {
      libraryStageSucceeded = false;
      // Per-novel attribution (round-2): every novel blocked by this
      // stage is named individually — no '(library removal)' sentinel —
      // so the caller's toast can say exactly which novels are untouched.
      const message = error instanceof Error ? error.message : String(error);
      for (const novelId of libraryIds) {
        failures.push({
          novelId,
          novelName:
            uniqueEntries.get(novelId)?.novelName ?? `Novel ${novelId}`,
          error: message,
        });
      }
    }
  }

  // Stage 4 (LAST): history clear only for novels whose purge made it here.
  // When the library stage failed, its novels keep their history.
  const historyTargets = libraryStageSucceeded
    ? filesCleared
    : filesCleared.filter(entry => !entry.inLibrary);
  for (const entry of historyTargets) {
    try {
      await io.deleteHistory(entry.novelId);
    } catch (error) {
      failures.push({
        novelId: entry.novelId,
        novelName: entry.novelName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    purgedNovels: uniqueEntries.size - failures.length,
    failures,
    legacyTaskCount,
  };
};

/**
 * Bulk-purge helper for the History screen (#1874). DELEGATES to the pure
 * runPurgeOrchestration — this hook only wires real implementations into
 * the injected io and surfaces toasts. No duplicated logic (review r2b).
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
      // Pre-flight decision: only consult/cancel the background queue when
      // a selected novel actually has something queued (round-2 review fix:
      // selected-novels-without-tasks are NOT unattributable).
      const touchesSelection = entries.some(entry =>
        downloadingNovelIds.has(entry.novelId),
      );

      const result = await runPurgeOrchestration(entries, {
        cancelForNovels: async novelIds => {
          if (!touchesSelection && novelIds.length > 0) {
            return 0;
          }
          const legacyCount = await backgroundTasks.cancelForNovels(novelIds);
          if (legacyCount > 0) {
            showToast(
              getString('historyScreen.unattributableDownloads', {
                count: legacyCount,
              }),
            );
          }
          return legacyCount;
        },
        getDownloadedChapters: getNovelDownloadedChapters,
        deleteChaptersFiles: deleteChapters,
        deleteHistory: deleteNovelHistory,
        removeFromLibrary: removeNovelsFromLibrary,
      });

      // R4 post-confirm outcome toast (round-2 review blocker 1): success
      // count, plus one line per failure when anything failed. Surfaced
      // HERE ONLY — the screen consumes the returned result without
      // re-toasting (double-toast bug fixed).
      showToast(
        getString('historyScreen.purgeSuccess', {
          count: result.purgedNovels,
        }),
        ...result.failures.map(failure =>
          getString('historyScreen.purgeFailurePrefix', {
            novelName: failure.novelName,
            error: failure.error,
          }),
        ),
      );

      return result;
    },
    [downloadingNovelIds],
  );

  return { purgeNovels };
};
