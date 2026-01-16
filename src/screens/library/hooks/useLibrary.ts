import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { getCategoriesFromDb } from '@database/queries/CategoryQueries';
import { getLibraryNovelsFromDb } from '@database/queries/LibraryQueries';

import { Category, NovelInfo } from '@database/types';

import { useLibrarySettings } from '@hooks/persisted';
import { LibrarySortOrder } from '../constants/constants';
import { switchNovelToLibraryQuery } from '@database/queries/NovelQueries';
import ServiceManager, {
  BackgroundTask,
  QueuedBackgroundTask,
} from '@services/ServiceManager';
import { useMMKVObject } from 'react-native-mmkv';

// type Library = Category & { novels: LibraryNovelInfo[] };
export type ExtendedCategory = Category & { novelIds: number[] };
export type UseLibraryReturnType = {
  library: NovelInfo[];
  categories: ExtendedCategory[];
  isLoading: boolean;
  setCategories: React.Dispatch<React.SetStateAction<ExtendedCategory[]>>;
  refreshCategories: () => Promise<void>;
  setLibrary: React.Dispatch<React.SetStateAction<NovelInfo[]>>;
  novelInLibrary: (pluginId: string, novelPath: string) => boolean;
  switchNovelToLibrary: (novelPath: string, pluginId: string) => Promise<void>;
  refetchLibrary: () => void;
  setLibrarySearchText: (text: string) => void;
};

export const useLibrary = (): UseLibraryReturnType => {
  const {
    filter,
    sortOrder = LibrarySortOrder.DateAdded_DESC,
    downloadedOnlyMode = false,
  } = useLibrarySettings();

  const [library, setLibrary] = useState<NovelInfo[]>([]);
  const [categories, setCategories] = useState<ExtendedCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchText, setSearchText] = useState('');

  const refreshCategories = useCallback(async () => {
    const dbCategories = getCategoriesFromDb();

    const res = dbCategories.map(c => ({
      ...c,
      novelIds: (c.novelIds ?? '').split(',').map(Number),
    }));

    const filteredCategories = res.filter((cat, index) => {
      if (index !== 0) {
        return true;
      }

      const hasUserCategories = res.length > 2;
      const hasNovels = cat.novelIds.length > 0 && cat.novelIds[0] !== 0;

      return !hasUserCategories || hasNovels;
    });

    setCategories(filteredCategories);
  }, []);

  const getLibrary = useCallback(async () => {
    if (searchText) {
      setIsLoading(true);
    }

    const [_, novels] = await Promise.all([
      refreshCategories(),
      getLibraryNovelsFromDb(sortOrder, filter, searchText, downloadedOnlyMode),
    ]);

    setLibrary(novels);
    setIsLoading(false);
  }, [downloadedOnlyMode, filter, refreshCategories, searchText, sortOrder]);

  const novelInLibrary = useCallback(
    (pluginId: string, novelPath: string) =>
      library?.some(
        novel => novel.pluginId === pluginId && novel.path === novelPath,
      ),
    [library],
  );

  const switchNovelToLibrary = useCallback(
    async (novelPath: string, pluginId: string) => {
      await switchNovelToLibraryQuery(novelPath, pluginId);

      // Important to get correct chapters count
      // Count is set by sql trigger
      refreshCategories();
      const novels = getLibraryNovelsFromDb(
        sortOrder,
        filter,
        searchText,
        downloadedOnlyMode,
      );

      setLibrary(novels);
    },
    [downloadedOnlyMode, filter, refreshCategories, searchText, sortOrder],
  );

  useFocusEffect(() => {
    getLibrary();
  });

  const [taskQueue] = useMMKVObject<
    Array<BackgroundTask | QueuedBackgroundTask>
  >(ServiceManager.manager.STORE_KEY);
  const restoreTasksCount = useMemo(
    () =>
      taskQueue?.filter(t => {
        /**
         * Handle backward compatibility: check for new format first, then old format
         */
        const taskName =
          (t as QueuedBackgroundTask)?.task?.name ||
          (t as BackgroundTask)?.name;
        return (
          taskName === 'LOCAL_RESTORE' ||
          taskName === 'DRIVE_RESTORE' ||
          taskName === 'SELF_HOST_RESTORE'
        );
      }).length || 0,
    [taskQueue],
  );
  const prevRestoreTasksCountRef = useRef(restoreTasksCount);

  useEffect(() => {
    if (prevRestoreTasksCountRef.current > 0 && restoreTasksCount === 0) {
      getLibrary();
    }
    prevRestoreTasksCountRef.current = restoreTasksCount;
  }, [getLibrary, restoreTasksCount]);

  return {
    library,
    categories,
    isLoading,
    setLibrary,
    setCategories,
    refreshCategories,
    novelInLibrary,
    switchNovelToLibrary,
    refetchLibrary: getLibrary,
    setLibrarySearchText: setSearchText,
  };
};

export const useLibraryNovels = () => {
  const [library, setLibrary] = useState<NovelInfo[]>([]);

  const getLibrary = async () => {
    const novels = getLibraryNovelsFromDb();

    setLibrary(novels);
  };

  useFocusEffect(
    useCallback(() => {
      getLibrary();
    }, []),
  );

  return { library, setLibrary };
};
