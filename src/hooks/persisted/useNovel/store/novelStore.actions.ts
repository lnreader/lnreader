import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';
import { NovelSettings } from '../types';
import {
  GetState,
  NovelStoreDependencies,
  NovelStoreNovelActions,
  SetState,
} from './novelStore.types';

interface CreateNovelStoreActionsParams {
  set: SetState;
  get: GetState;
  deps: NovelStoreDependencies;
  defaultChapterSort: ChapterOrderKey;
}

export const createNovelStoreActions = ({
  set,
  get,
  deps,
  defaultChapterSort,
}: CreateNovelStoreActionsParams): NovelStoreNovelActions => {
  let inflightBootstrap: Promise<boolean> | null = null;

  const getSettingsSort = (settings: NovelSettings): ChapterOrderKey =>
    settings.sort || defaultChapterSort;

  const getSettingsFilter = (settings: NovelSettings): ChapterFilterKey[] =>
    settings.filter ?? [];

  const persistResolvedPageIndex = (pageIndex: number) => {
    if (get().pageIndex !== pageIndex) {
      deps.persistPageIndex?.(pageIndex);
    }
  };

  return {
    bootstrapNovel: async () => {
      if (inflightBootstrap) {
        return inflightBootstrap;
      }

      const requestId = deps.chapterRequestCoordinator.invalidate();
      inflightBootstrap = (async () => {
        set({ loading: true, fetching: true });

        const state = get();
        const result = await deps.bootstrapService.bootstrapNovelAsync({
          novel: state.novel,
          novelPath: state.novelPath,
          pluginId: state.pluginId,
          pageIndex: state.pageIndex,
          settingsSort: getSettingsSort(state.novelSettings),
          settingsFilter: getSettingsFilter(state.novelSettings),
          excludedScanlators: state.novelSettings.excludedScanlators,
        });

        if (requestId !== deps.chapterRequestCoordinator.current()) {
          return false;
        }

        if (!result.ok) {
          set({
            loading: false,
            fetching: false,
          });
          return false;
        }

        persistResolvedPageIndex(result.pageIndex);
        set({
          loading: false,
          fetching: false,
          novel: result.novel,
          pages: result.pages,
          pageIndex: result.pageIndex,
          chapters: deps.transformChapters(result.chapters),
          batchInformation: result.batchInformation,
          firstUnreadChapter: result.firstUnreadChapter,
          scanlators: result.scanlators,
        });

        return true;
      })().finally(() => {
        inflightBootstrap = null;
      });

      return inflightBootstrap;
    },
    bootstrapNovelSync: () => {
      deps.chapterRequestCoordinator.invalidate();
      const state = get();
      const result = deps.bootstrapService.bootstrapNovelSync({
        novel: state.novel,
        novelPath: state.novelPath,
        pluginId: state.pluginId,
        pageIndex: state.pageIndex,
        settingsSort: getSettingsSort(state.novelSettings),
        settingsFilter: getSettingsFilter(state.novelSettings),
        excludedScanlators: state.novelSettings.excludedScanlators,
      });

      if (!result.ok) {
        return false;
      }

      persistResolvedPageIndex(result.pageIndex);
      set({
        loading: false,
        fetching: false,
        novel: result.novel,
        pages: result.pages,
        pageIndex: result.pageIndex,
        chapters: deps.transformChapters(result.chapters),
        batchInformation: result.batchInformation,
        firstUnreadChapter: result.firstUnreadChapter,
        scanlators: result.scanlators,
      });

      return true;
    },

    getChapters: async () => {
      const state = get();
      if (!state.novel || state.pages.length === 0) {
        return;
      }

      const requestId = deps.chapterRequestCoordinator.invalidate();
      const pageIndex = Math.min(
        Math.max(state.pageIndex, 0),
        state.pages.length - 1,
      );
      persistResolvedPageIndex(pageIndex);
      if (pageIndex !== state.pageIndex) {
        set({ pageIndex });
      }
      set({ loading: false, fetching: true });
      try {
        const result = await deps.bootstrapService.getChaptersForPage({
          novel: state.novel,
          novelPath: state.novelPath,
          pluginId: state.pluginId,
          pages: state.pages,
          pageIndex,
          settingsSort: getSettingsSort(state.novelSettings),
          settingsFilter: getSettingsFilter(state.novelSettings),
          excludedScanlators: state.novelSettings.excludedScanlators,
        });

        if (requestId !== deps.chapterRequestCoordinator.current()) {
          return;
        }

        set({
          chapters: deps.transformChapters(result.chapters),
          batchInformation: result.batchInformation,
          firstUnreadChapter: result.firstUnreadChapter,
        });
      } finally {
        if (requestId === deps.chapterRequestCoordinator.current()) {
          set({ fetching: false });
        }
      }
    },

    refreshNovel: async () => {
      const requestId = deps.chapterRequestCoordinator.invalidate();
      set({ loading: true, fetching: true });
      try {
        const state = get();
        const refreshed = await deps.bootstrapService.bootstrapNovelAsync({
          novel: undefined,
          novelPath: state.novelPath,
          pluginId: state.pluginId,
          pageIndex: state.pageIndex,
          settingsSort: getSettingsSort(state.novelSettings),
          settingsFilter: getSettingsFilter(state.novelSettings),
          excludedScanlators: state.novelSettings.excludedScanlators,
        });

        if (!refreshed.ok) {
          return;
        }

        if (requestId !== deps.chapterRequestCoordinator.current()) {
          return;
        }

        persistResolvedPageIndex(refreshed.pageIndex);
        set({
          novel: refreshed.novel,
          pages: refreshed.pages,
          pageIndex: refreshed.pageIndex,
          chapters: deps.transformChapters(refreshed.chapters),
          batchInformation: refreshed.batchInformation,
          firstUnreadChapter: refreshed.firstUnreadChapter,
          scanlators: refreshed.scanlators,
        });
      } finally {
        if (requestId === deps.chapterRequestCoordinator.current()) {
          set({ loading: false, fetching: false });
        }
      }
    },

    setNovel: novelState => set({ novel: novelState }),
    setPages: pagesState => set({ pages: pagesState }),
    setPageIndex: index => {
      set({ pageIndex: index });
      deps.persistPageIndex?.(index);
    },
    openPage: async index => {
      const pages = get().pages;
      if (pages.length === 0) {
        return;
      }
      const resolvedIndex = Math.min(Math.max(index, 0), pages.length - 1);
      set({ pageIndex: resolvedIndex });
      deps.persistPageIndex?.(resolvedIndex);
      await get().actions.getChapters();
    },
    setNovelSettings: settings => {
      set({ novelSettings: settings });
      deps.persistNovelSettings?.(settings);

      const state = get();
      if (state.novel && state.pages.length > 0) {
        void state.actions.getChapters();
      }
    },
    setLastRead: chapter => {
      set({ lastRead: chapter });
      deps.persistLastRead?.(chapter);
    },
    followNovel: async () => {
      const state = get();
      const currentNovel = state.novel;
      if (!currentNovel || !deps.switchNovelToLibrary) {
        return;
      }

      await deps.switchNovelToLibrary(state.novelPath, state.pluginId);
      set(inner => {
        if (!inner.novel) {
          return {};
        }
        return {
          novel: {
            ...inner.novel,
            inLibrary: !inner.novel.inLibrary,
          },
        };
      });
    },
  };
};
