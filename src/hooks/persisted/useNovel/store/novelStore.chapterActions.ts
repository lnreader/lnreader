import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';
import { ChapterInfo } from '@database/types';
import { createBootstrapService } from '../store-helper/bootstrapService';
import {
  bookmarkChaptersAction,
  ChapterActionsDependencies,
  deleteChapterAction,
  deleteChaptersAction,
  increaseTimeSpentAction,
  markChapterReadAction,
  markChaptersReadAction,
  markChaptersUnreadAction,
  markChaptersUnreadAndResetProgressAction,
  markPreviouschaptersReadAction,
  markPreviousChaptersUnreadAction,
  updateChapterProgressAction,
} from './chapterActions';
import { NovelSettings } from '../types';
import {
  ChapterTextCacheApi,
  ChapterRequestCoordinator,
  GetState,
  NovelStoreChapterActions,
  SetState,
} from './novelStore.types';

interface CreateNovelStoreChapterActionsParams {
  set: SetState;
  get: GetState;
  bootstrapService: Pick<
    ReturnType<typeof createBootstrapService>,
    'getNextChapterBatch' | 'loadUpToBatch'
  >;
  chapterActionsDependencies: ChapterActionsDependencies;
  chapterRequestCoordinator: ChapterRequestCoordinator;
  transformChapters: (chs: ChapterInfo[]) => ChapterInfo[];
  defaultChapterSort: ChapterOrderKey;
}

export const createNovelStoreChapterActions = ({
  set,
  get,
  bootstrapService,
  chapterActionsDependencies,
  chapterRequestCoordinator,
  transformChapters,
  defaultChapterSort,
}: CreateNovelStoreChapterActionsParams): NovelStoreChapterActions => {
  let inflightNextChapterBatch:
    | { version: number; promise: Promise<void> }
    | undefined;
  let inflightLoadUpToBatch:
    | {
        version: number;
        pendingTargetBatch: number | null;
        promise: Promise<void>;
      }
    | undefined;

  const mutateChapters = (mutation: (chs: ChapterInfo[]) => ChapterInfo[]) => {
    if (get().novel) {
      set(state => ({ chapters: mutation(state.chapters) }));
    }
  };

  const setChapters = (chs: ChapterInfo[]) => {
    set({ chapters: transformChapters(chs) });
  };

  const getSettingsSort = (settings: NovelSettings): ChapterOrderKey =>
    settings.sort || defaultChapterSort;

  const getSettingsFilter = (settings: NovelSettings): ChapterFilterKey[] =>
    settings.filter ?? [];

  const createChapterTextCache = (): ChapterTextCacheApi => {
    return {
      read: chapterId => get().chapterTextCache[chapterId],
      write: (chapterId, value) => {
        set({
          chapterTextCache: {
            ...get().chapterTextCache,
            [chapterId]: value,
          },
        });
      },
      remove: chapterId => {
        const { [chapterId]: _ignored, ...rest } = get().chapterTextCache;
        set({
          chapterTextCache: rest,
        });
      },
      clear: () => {
        set({
          chapterTextCache: {},
        });
      },
    };
  };

  const appendBatch = (
    version: number,
    batch: number,
    chapters: ChapterInfo[],
  ) => {
    if (version !== chapterRequestCoordinator.current()) {
      return;
    }

    set(curr => {
      if (batch <= curr.batchInformation.batch) {
        return {};
      }

      const existingIds = new Set(curr.chapters.map(chapter => chapter.id));
      const newChapters = chapters.filter(
        chapter => !existingIds.has(chapter.id),
      );
      return {
        batchInformation: {
          ...curr.batchInformation,
          batch,
        },
        chapters: curr.chapters.concat(newChapters),
      };
    });
  };

  const queueLoadUpToBatch = (targetBatch: number): Promise<void> => {
    const version = chapterRequestCoordinator.current();
    if (inflightLoadUpToBatch?.version === version) {
      inflightLoadUpToBatch.pendingTargetBatch = Math.max(
        inflightLoadUpToBatch.pendingTargetBatch ?? targetBatch,
        targetBatch,
      );
      return inflightLoadUpToBatch.promise;
    }

    const request = {
      version,
      pendingTargetBatch: targetBatch as number | null,
      promise: Promise.resolve(),
    };
    request.promise = (async () => {
      while (
        request.pendingTargetBatch !== null &&
        request.version === chapterRequestCoordinator.current()
      ) {
        const nextTarget = request.pendingTargetBatch;
        request.pendingTargetBatch = null;
        const state = get();

        if (nextTarget <= state.batchInformation.batch) {
          continue;
        }

        await bootstrapService.loadUpToBatch({
          targetBatch: nextTarget,
          novel: state.novel,
          pages: state.pages,
          pageIndex: state.pageIndex,
          settingsSort: getSettingsSort(state.novelSettings),
          settingsFilter: getSettingsFilter(state.novelSettings),
          batchInformation: state.batchInformation,
          onBatchLoaded: (batch, chapters) => {
            appendBatch(request.version, batch, transformChapters(chapters));
          },
          excludedScanlators: state.novelSettings.excludedScanlators,
        });
      }
    })().finally(() => {
      if (inflightLoadUpToBatch === request) {
        inflightLoadUpToBatch = undefined;
      }
    });

    inflightLoadUpToBatch = request;
    return request.promise;
  };

  return {
    chapterTextCache: createChapterTextCache(),
    getNextChapterBatch: async () => {
      const version = chapterRequestCoordinator.current();
      if (inflightNextChapterBatch?.version === version) {
        return inflightNextChapterBatch.promise;
      }

      const state = get();
      const request = {
        version,
        promise: Promise.resolve(),
      };
      request.promise = (async () => {
        const result = await bootstrapService.getNextChapterBatch({
          novel: state.novel,
          pages: state.pages,
          pageIndex: state.pageIndex,
          settingsSort: getSettingsSort(state.novelSettings),
          settingsFilter: getSettingsFilter(state.novelSettings),
          batchInformation: state.batchInformation,
          excludedScanlators: state.novelSettings.excludedScanlators,
        });

        if (
          !result ||
          request.version !== chapterRequestCoordinator.current()
        ) {
          return;
        }

        appendBatch(
          request.version,
          result.batch,
          transformChapters(result.chapters),
        );
      })().finally(() => {
        if (inflightNextChapterBatch === request) {
          inflightNextChapterBatch = undefined;
        }
      });

      inflightNextChapterBatch = request;
      return request.promise;
    },

    loadUpToBatch: async (targetBatch: number) => {
      await queueLoadUpToBatch(targetBatch);
    },

    updateChapter: (index, update) => {
      if (get().novel) {
        set(state => {
          const next = [...state.chapters];
          next[index] = { ...next[index], ...update };
          return {
            chapters: next,
          };
        });
      }
    },

    setChapters,

    extendChapters: chs => {
      set(state => ({
        chapters: state.chapters.concat(transformChapters(chs)),
      }));
    },

    bookmarkChapters: chaptersState => {
      bookmarkChaptersAction(
        chaptersState,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    markPreviouschaptersRead: chapterId => {
      markPreviouschaptersReadAction(
        chapterId,
        get().novel,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    markChapterRead: chapterId => {
      markChapterReadAction(
        chapterId,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    markChaptersRead: chaptersState => {
      markChaptersReadAction(
        chaptersState,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    markPreviousChaptersUnread: chapterId => {
      markPreviousChaptersUnreadAction(
        chapterId,
        get().novel,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    markChaptersUnread: chaptersState => {
      markChaptersUnreadAction(
        chaptersState,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    markChaptersUnreadAndResetProgress: chaptersState =>
      markChaptersUnreadAndResetProgressAction(
        chaptersState,
        mutateChapters,
        chapterActionsDependencies,
      ),

    updateChapterProgress: (chapterId, progress) => {
      updateChapterProgressAction(
        chapterId,
        progress,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    deleteChapter: chapter => {
      deleteChapterAction(
        chapter,
        get().novel,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    deleteChapters: chaptersState => {
      deleteChaptersAction(
        chaptersState,
        get().novel,
        mutateChapters,
        chapterActionsDependencies,
      );
    },

    refreshChapters: () => {
      void get().actions.getChapters();
    },

    increaseTimeSpent: (chapterId, timeSpent) => {
      increaseTimeSpentAction(
        chapterId,
        timeSpent,
        mutateChapters,
        chapterActionsDependencies,
      );
    },
  };
};
