import {
  getLibraryNovelsForGlobalUpdate,
  getLibraryWithCategory,
} from '../../database/queries/LibraryQueries';

import { showToast } from '../../utils/showToast';
import { updateNovel, type UpdateNovelOptions } from './LibraryUpdateQueries';
import type { DBNovelInfo } from '@database/types';
import { sleep } from '@utils/sleep';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import dayjs from 'dayjs';
import {
  APP_SETTINGS,
  AppSettings,
  getGlobalUpdateCategoryFilters,
} from '@hooks/persisted/useSettings';
import type {
  BackgroundTask,
  BackgroundTaskEnqueuer,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { reportLibraryUpdateProgress, syncWidgets } from '@services/widgets';

const UPDATE_SOURCE_CONCURRENCY = 3;

const groupNovelsByPlugin = (novels: DBNovelInfo[]) => {
  const groupedNovels = new Map<string, DBNovelInfo[]>();

  for (const novel of novels) {
    const pluginNovels = groupedNovels.get(novel.pluginId);
    if (pluginNovels) {
      pluginNovels.push(novel);
    } else {
      groupedNovels.set(novel.pluginId, [novel]);
    }
  }

  return [...groupedNovels.values()];
};
const MAX_DOWNLOAD_CHAPTERS_PER_TASK = 100;

const enqueueDownloadTasks = (
  enqueue: BackgroundTaskEnqueuer,
  tasks: BackgroundTask | BackgroundTask[],
) => {
  for (const task of Array.isArray(tasks) ? tasks : [tasks]) {
    if (task.name !== 'DOWNLOAD_CHAPTER') {
      enqueue(task);
      continue;
    }

    const chapters = task.data.chapters.map(chapter =>
      chapter.novelId === undefined && task.data.novelId !== undefined
        ? { ...chapter, novelId: task.data.novelId }
        : chapter,
    );

    for (
      let start = 0;
      start < chapters.length;
      start += MAX_DOWNLOAD_CHAPTERS_PER_TASK
    ) {
      enqueue({
        ...task,
        data: {
          ...task.data,
          chapters: chapters.slice(
            start,
            start + MAX_DOWNLOAD_CHAPTERS_PER_TASK,
          ),
        },
      });
    }
  }
};

const updateLibrary = async (
  {
    categoryId,
  }: {
    categoryId?: number;
  },
  setMeta: TaskProgressUpdater,
  enqueue: BackgroundTaskEnqueuer,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
  }));
  reportLibraryUpdateProgress(true);

  const {
    downloadNewChapters,
    refreshNovelMetadata,
    smartUpdateSkipCompleted,
    smartUpdateSkipUnstarted,
    smartUpdateSkipWithUnread,
  } = getMMKVObject<AppSettings>(APP_SETTINGS) || {};
  const smartUpdateFilters = {
    skipCompleted: Boolean(smartUpdateSkipCompleted),
    skipUnstarted: Boolean(smartUpdateSkipUnstarted),
    skipWithUnread: Boolean(smartUpdateSkipWithUnread),
  };
  const options: UpdateNovelOptions = {
    downloadNewChapters: downloadNewChapters || false,
    refreshNovelMetadata: refreshNovelMetadata || false,
    enqueue: tasks => enqueueDownloadTasks(enqueue, tasks),
  };

  try {
    let libraryNovels: DBNovelInfo[] = [];
    if (categoryId) {
      libraryNovels = await getLibraryWithCategory(categoryId, true);
    } else {
      libraryNovels = await getLibraryNovelsForGlobalUpdate(
        getGlobalUpdateCategoryFilters(),
        smartUpdateFilters,
      );
    }

    if (libraryNovels.length > 0) {
      MMKVStorage.set(LAST_UPDATE_TIME, dayjs().format('YYYY-MM-DD HH:mm:ss'));

      const sourceQueues = groupNovelsByPlugin(libraryNovels);
      const activeNovels = new Map<string, string>();
      let completedNovels = 0;
      let nextSourceQueue = 0;
      let reportedNovels = -1;

      const publishProgress = () => {
        setMeta(meta => ({
          ...meta,
          progressText: [...activeNovels.values()].join('\n') || undefined,
          progress: completedNovels / libraryNovels.length,
        }));
        if (completedNovels !== reportedNovels) {
          reportedNovels = completedNovels;
          reportLibraryUpdateProgress(
            true,
            completedNovels,
            libraryNovels.length,
          );
        }
      };

      const updateSourceQueue = async (sourceQueue: DBNovelInfo[]) => {
        for (const novel of sourceQueue) {
          activeNovels.set(novel.pluginId, novel.name);
          publishProgress();

          try {
            await updateNovel(novel.pluginId, novel.path, novel.id, options);
            await sleep(1000);
          } catch (error: unknown) {
            showToast(
              novel.name +
                ': ' +
                (error instanceof Error ? error.message : String(error)),
            );
          } finally {
            completedNovels += 1;
            activeNovels.delete(novel.pluginId);
            publishProgress();
          }
        }
      };

      const updateNextSource = async () => {
        while (nextSourceQueue < sourceQueues.length) {
          const sourceQueue = sourceQueues[nextSourceQueue];
          nextSourceQueue += 1;
          await updateSourceQueue(sourceQueue);
        }
      };

      const sourceResults = await Promise.allSettled(
        Array.from(
          {
            length: Math.min(UPDATE_SOURCE_CONCURRENCY, sourceQueues.length),
          },
          updateNextSource,
        ),
      );
      const rejectedSource = sourceResults.find(
        result => result.status === 'rejected',
      );
      if (rejectedSource?.status === 'rejected') {
        throw rejectedSource.reason;
      }
    } else {
      showToast("There's no novel to be updated");
    }
  } finally {
    setMeta(meta => ({
      ...meta,
      progress: 1,
      progressText: undefined,
      isRunning: false,
    }));
    reportLibraryUpdateProgress(false);
    await syncWidgets();
  }
};

export { updateLibrary };
