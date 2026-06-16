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

  return {
    bootstrapNovel: async () => {
      if (inflightBootstrap) {
        return inflightBootstrap;
      }

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

        if (!result.ok) {
          set({
            loading: false,
            fetching: false,
          });
          return false;
        }

        set({
          loading: false,
          fetching: false,
          novel: result.novel,
          pages: result.pages,
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

      set({
        loading: false,
        fetching: false,
        novel: result.novel,
        pages: result.pages,
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

      set({ fetching: true });
      try {
        const result = await deps.bootstrapService.getChaptersForPage({
          novel: state.novel,
          novelPath: state.novelPath,
          pluginId: state.pluginId,
          pages: state.pages,
          pageIndex: state.pageIndex,
          settingsSort: getSettingsSort(state.novelSettings),
          settingsFilter: getSettingsFilter(state.novelSettings),
          excludedScanlators: state.novelSettings.excludedScanlators,
        });

        set({
          chapters: deps.transformChapters(result.chapters),
          batchInformation: result.batchInformation,
          firstUnreadChapter: result.firstUnreadChapter,
        });
      } finally {
        set({ fetching: false });
      }
    },

    refreshNovel: async () => {
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

        set({
          novel: refreshed.novel,
          pages: refreshed.pages,
          chapters: deps.transformChapters(refreshed.chapters),
          batchInformation: refreshed.batchInformation,
          firstUnreadChapter: refreshed.firstUnreadChapter,
          scanlators: refreshed.scanlators,
        });
      } finally {
        set({ loading: false, fetching: false });
      }
    },

    setNovel: novelState => set({ novel: novelState }),
    setPages: pagesState => set({ pages: pagesState }),
    setPageIndex: index => {
      set({ pageIndex: index });
      deps.persistPageIndex?.(index);
    },
    openPage: async index => {
      set({ pageIndex: index });
      deps.persistPageIndex?.(index);
      await get().actions.getChapters();
    },
    setNovelSettings: settings => {
      set({ novelSettings: settings });
      deps.persistNovelSettings?.(settings);

      const state = get();
      if (state.novel && state.pages.length > 0) {
        state.actions.getChapters();
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
