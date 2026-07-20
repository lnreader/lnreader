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
  markPreviouschaptersReadAction,
  markPreviousChaptersUnreadAction,
  refreshChaptersAction,
  updateChapterProgressAction,
} from './chapterActions';
import { NovelSettings } from '../types';
import {
  ChapterTextCacheApi,
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
  transformChapters: (chs: ChapterInfo[]) => ChapterInfo[];
  defaultChapterSort: ChapterOrderKey;
}

export const createNovelStoreChapterActions = ({
  set,
  get,
  bootstrapService,
  chapterActionsDependencies,
  transformChapters,
  defaultChapterSort,
}: CreateNovelStoreChapterActionsParams): NovelStoreChapterActions => {
  let inflightNextChapterBatch: Promise<void> | null = null;
  let inflightLoadUpToBatch: Promise<void> | null = null;
  let pendingTargetBatch: number | null = null;

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
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

  const appendBatch = (batch: number, chapters: ChapterInfo[]) => {
    set(curr => {
      if (batch <= curr.batchInformation.batch) {
        return {};
      }

      return {
        batchInformation: {
          ...curr.batchInformation,
          batch,
        },
        chapters: curr.chapters.concat(chapters),
      };
    });
  };

  const queueLoadUpToBatch = (targetBatch: number): Promise<void> => {
    pendingTargetBatch = Math.max(
      pendingTargetBatch ?? targetBatch,
      targetBatch,
    );

    if (inflightLoadUpToBatch) {
      return inflightLoadUpToBatch;
    }

    inflightLoadUpToBatch = (async () => {
      while (pendingTargetBatch !== null) {
        const nextTarget = pendingTargetBatch;
        pendingTargetBatch = null;
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
            appendBatch(batch, transformChapters(chapters));
          },
          excludedScanlators: state.novelSettings.excludedScanlators,
        });
      }
    })().finally(() => {
      inflightLoadUpToBatch = null;
      pendingTargetBatch = null;
    });

    return inflightLoadUpToBatch;
  };

  return {
    chapterTextCache: createChapterTextCache(),
    getNextChapterBatch: async () => {
      if (inflightNextChapterBatch) {
        return inflightNextChapterBatch;
      }

      const state = get();
      inflightNextChapterBatch = (async () => {
        const result = await bootstrapService.getNextChapterBatch({
          novel: state.novel,
          pages: state.pages,
          pageIndex: state.pageIndex,
          settingsSort: getSettingsSort(state.novelSettings),
          settingsFilter: getSettingsFilter(state.novelSettings),
          batchInformation: state.batchInformation,
          excludedScanlators: state.novelSettings.excludedScanlators,
        });

        if (!result) {
          return;
        }

        appendBatch(result.batch, transformChapters(result.chapters));
      })().finally(() => {
        inflightNextChapterBatch = null;
      });

      return inflightNextChapterBatch;
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
      const state = get();
      refreshChaptersAction({
        novel: state.novel,
        fetching: state.fetching,
        settingsSort: getSettingsSort(state.novelSettings),
        settingsFilter: getSettingsFilter(state.novelSettings),
        currentPage: state.pages[state.pageIndex] ?? '1',
        transformChapters,
        setChapters,
        deps: chapterActionsDependencies,
      });
    },

	increaseTimeSpent: (chapterId, timeSpent) => {
	  increaseTimeSpentAction(
		chapterId,
		timeSpent,
		mutateChapters,
		chapterActionsDependencies,
	  );
	}
  };
};
