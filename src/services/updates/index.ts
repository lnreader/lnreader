import {
  getLibraryWithCategory,
  getLibraryNovelsFromDb,
} from '../../database/queries/LibraryQueries';

import { showToast } from '../../utils/showToast';
import { UpdateNovelOptions, updateNovel } from './LibraryUpdateQueries';
import { LibraryNovelInfo } from '@database/types';
import { sleep } from '@utils/sleep';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import dayjs from 'dayjs';
import { APP_SETTINGS, AppSettings } from '@hooks/persisted/useSettings';
import { BackgroundTaskMetadata } from '@services/ServiceManager';

/**
 * Compute delay with optional jitter to look less bot-like.
 * Jitter adds 0-500ms of random extra delay.
 */
const getDelay = (baseDelay: number, useJitter: boolean): number => {
  if (useJitter) {
    return baseDelay + Math.floor(Math.random() * 500);
  }
  return baseDelay;
};

/**
 * Sort novels so the most important updates happen first:
 *  1. Novels with unread chapters (ascending - fewer unread = updated first)
 *  2. Ongoing novels before completed
 *  3. Alphabetical as tiebreaker
 *
 * This way if the user cancels mid-update, the most relevant novels
 * have already been checked.
 */
const prioritizeNovels = (
  novels: LibraryNovelInfo[],
): LibraryNovelInfo[] => {
  return [...novels].sort((a, b) => {
    // Ongoing novels first
    const aOngoing = a.status === 'Ongoing' ? 0 : 1;
    const bOngoing = b.status === 'Ongoing' ? 0 : 1;
    if (aOngoing !== bOngoing) {
      return aOngoing - bOngoing;
    }
    // Then alphabetical for consistent ordering
    return (a.name || '').localeCompare(b.name || '');
  });
};

/**
 * Group novels by pluginId (source) so each source can be processed
 * as an independent lane. Within each source, novels keep their
 * prioritized order.
 */
const groupBySource = (
  novels: LibraryNovelInfo[],
): Map<string, LibraryNovelInfo[]> => {
  const bySource = new Map<string, LibraryNovelInfo[]>();
  for (const novel of novels) {
    const list = bySource.get(novel.pluginId) || [];
    list.push(novel);
    bySource.set(novel.pluginId, list);
  }
  return bySource;
};

/**
 * Mihon-inspired semaphore: runs up to `limit` async tasks in parallel.
 * As each task finishes (or fails), the next pending task starts.
 */
const runWithConcurrency = async (
  tasks: (() => Promise<void>)[],
  limit: number,
): Promise<void> => {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task().finally(() => executing.delete(p));
    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
};

const updateLibrary = async (
  {
    categoryId,
  }: {
    categoryId?: number;
  },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
  }));

  try {
    await _updateLibraryInner(categoryId, setMeta);
  } catch (error: any) {
    // Top-level safety net — never let an unhandled error crash the background service
    showToast('Library update failed: ' + (error?.message || String(error)));
  } finally {
    setMeta(meta => ({
      ...meta,
      progress: 1,
      isRunning: false,
    }));
  }
};

const _updateLibraryInner = async (
  categoryId: number | undefined,
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  const appSettings = getMMKVObject<AppSettings>(APP_SETTINGS) || {};
  const {
    downloadNewChapters,
    refreshNovelMetadata,
    onlyUpdateOngoingNovels,
    updateDelay = 1000,
    useUpdateJitter = true,
  } = appSettings;

  const options: UpdateNovelOptions = {
    downloadNewChapters: downloadNewChapters || false,
    refreshNovelMetadata: refreshNovelMetadata || false,
  };

  let libraryNovels: LibraryNovelInfo[] = [];
  if (categoryId) {
    libraryNovels = getLibraryWithCategory(
      categoryId,
      onlyUpdateOngoingNovels,
      true,
    );
  } else {
    libraryNovels = getLibraryNovelsFromDb(
      '',
      onlyUpdateOngoingNovels ? "status = 'Ongoing'" : '',
      '',
      false,
      true,
    ) as LibraryNovelInfo[];
  }

  if (libraryNovels.length === 0) {
    showToast("There's no novel to be updated");
    return;
  }

  // Prioritize, then group by source for parallel processing
  libraryNovels = prioritizeNovels(libraryNovels);
  const sourceGroups = groupBySource(libraryNovels);

  MMKVStorage.set(LAST_UPDATE_TIME, dayjs().format('YYYY-MM-DD HH:mm:ss'));

  // Shared state across parallel source lanes
  let completedCount = 0;
  const totalCount = libraryNovels.length;
  let globalAbort = false;
  let totalErrors = 0;
  const MAX_TOTAL_ERRORS = 15;

  /**
   * Process one source's novels sequentially.
   * Each source lane manages its own consecutive-error backoff.
   */
  const processSourceGroup = async (
    sourceNovels: LibraryNovelInfo[],
  ): Promise<void> => {
    let consecutiveErrors = 0;
    const MAX_CONSECUTIVE_ERRORS = 5;

    for (const novel of sourceNovels) {
      if (globalAbort) {
        break;
      }

      completedCount++;
      setMeta(meta => ({
        ...meta,
        progressText: `(${completedCount}/${totalCount}) ${novel.name}`,
        progress: completedCount / totalCount,
      }));

      try {
        await updateNovel(
          novel.pluginId,
          novel.path,
          novel.id,
          options,
        );
        consecutiveErrors = 0;

        // Delay between requests within this source
        await sleep(getDelay(updateDelay, useUpdateJitter));
      } catch (error: any) {
        consecutiveErrors++;
        totalErrors++;
        showToast(
          novel.name + ': ' + (error?.message || String(error)),
        );

        if (totalErrors >= MAX_TOTAL_ERRORS) {
          // Too many total failures across all sources — abort everything
          showToast(
            `${totalErrors} total errors. Stopping library update.`,
          );
          globalAbort = true;
          break;
        } else if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
          // Source-level backoff: likely rate-limited by this source
          showToast(
            `${consecutiveErrors} consecutive errors from ${novel.pluginId}. Waiting 10s...`,
          );
          await sleep(10000);
          consecutiveErrors = 0;
        } else if (consecutiveErrors >= 3) {
          // Moderate backoff after 3 consecutive errors in this source
          await sleep(getDelay(updateDelay * 3, useUpdateJitter));
        } else {
          await sleep(getDelay(updateDelay, useUpdateJitter));
        }
      }
    }
  };

  // Process up to 3 sources in parallel (Mihon-style concurrency)
  const SOURCE_CONCURRENCY = 3;
  const sourceTasks = Array.from(sourceGroups.values()).map(
    sourceNovels => () => processSourceGroup(sourceNovels),
  );
  await runWithConcurrency(sourceTasks, SOURCE_CONCURRENCY);
};

export { updateLibrary };
