import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { getCategoriesFromDb } from '@database/queries/CategoryQueries';
import {
  getLibraryNovelsFromDb,
  getLibraryNovelsQuery,
} from '@database/queries/LibraryQueries';
import { useLiveQuery } from '@database/manager/liveQuery';

import { Category, NovelInfo } from '@database/types';

import { useLibrarySettings } from '@hooks/persisted';
import { LibrarySortOrder } from '../constants/constants';
import { switchNovelToLibraryQuery } from '@database/queries/NovelQueries';
import {
  BACKGROUND_TASKS_STORE_KEY,
  BackgroundTask,
  getDownloadProgressKey,
  QueuedBackgroundTask,
} from '@services/backgroundTasks';
import { useMMKVObject } from 'react-native-mmkv';

// type Library = Category & { novels: LibraryNovelInfo[] };
export type ExtendedCategory = Category & { novelIds: number[] };
export type UseLibraryReturnType = {
  library: NovelInfo[];
  categories: ExtendedCategory[];
  isLoading: boolean;
  error?: unknown;
  setCategories: React.Dispatch<React.SetStateAction<ExtendedCategory[]>>;
  refreshCategories: () => Promise<void>;
  setLibrary: React.Dispatch<React.SetStateAction<NovelInfo[]>>;
  novelInLibrary: (pluginId: string, novelPath: string) => boolean;
  switchNovelToLibrary: (novelPath: string, pluginId: string) => Promise<void>;
  refetchLibrary: () => Promise<void>;
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
  const [error, setError] = useState<unknown>();
  const [searchText, setSearchText] = useState('');
  const hasLoadedRef = useRef(false);
  const hasErrorRef = useRef(false);
  const loadRequestIdRef = useRef(0);

  const libraryQuery = useMemo(
    () =>
      getLibraryNovelsQuery(sortOrder, filter, searchText, downloadedOnlyMode),
    [downloadedOnlyMode, filter, searchText, sortOrder],
  );
  useLiveQuery(libraryQuery, [{ table: 'Novel' }], setLibrary);

  const refreshCategories = useCallback(async () => {
    const dbCategories = await getCategoriesFromDb();

    const res = dbCategories.map((c, i) => ({
      ...c,
      sort: c.sort ?? i,
      novelIds: (c.novelIds ?? '').split(',').map(Number),
    }));

    const filteredCategories = res.filter(cat => {
      if (cat.id !== 1) {
        return true;
      }

      const hasUserCategories = res.length > 2;
      const hasNovels = cat.novelIds.length > 0 && cat.novelIds[0] !== 0;

      return !hasUserCategories || hasNovels;
    });

    setCategories(filteredCategories);
  }, []);

  const getLibrary = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    if (!hasLoadedRef.current || hasErrorRef.current || searchText) {
      setIsLoading(true);
    }
    hasErrorRef.current = false;
    setError(undefined);

    try {
      const [, novels] = await Promise.all([
        refreshCategories(),
        getLibraryNovelsFromDb(
          sortOrder,
          filter,
          searchText,
          downloadedOnlyMode,
        ),
      ]);

      if (requestId === loadRequestIdRef.current) {
        setLibrary(novels);
      }
    } catch (loadError) {
      if (requestId === loadRequestIdRef.current) {
        hasErrorRef.current = true;
        setError(loadError);
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        hasLoadedRef.current = true;
        setIsLoading(false);
      }
    }
  }, [downloadedOnlyMode, filter, refreshCategories, searchText, sortOrder]);

  const libraryLookup = useMemo(() => {
    const set = new Set<string>();
    for (const novel of library) {
      set.add(`${novel.pluginId}::${novel.path}`);
    }
    return set;
  }, [library]);

  const novelInLibrary = useCallback(
    (pluginId: string, novelPath: string) =>
      libraryLookup.has(`${pluginId}::${novelPath}`),
    [libraryLookup],
  );

  const switchNovelToLibrary = useCallback(
    async (novelPath: string, pluginId: string) => {
      await switchNovelToLibraryQuery(novelPath, pluginId);

      // Important to get correct chapters count
      // Count is set by sql trigger
      await refreshCategories();
      const novels = await getLibraryNovelsFromDb(
        sortOrder,
        filter,
        searchText,
        downloadedOnlyMode,
      );

      setLibrary(novels);
    },
    [downloadedOnlyMode, filter, refreshCategories, searchText, sortOrder],
  );

  useFocusEffect(
    useCallback(() => {
      void getLibrary();
    }, [getLibrary]),
  );

  const [taskQueue] = useMMKVObject<(BackgroundTask | QueuedBackgroundTask)[]>(
    BACKGROUND_TASKS_STORE_KEY,
  );
  const downloadProgressKey = useMemo(
    () => getDownloadProgressKey(taskQueue),
    [taskQueue],
  );
  const previousDownloadProgressKeyRef = useRef(downloadProgressKey);
  const hadDownloadTasksRef = useRef(downloadProgressKey.length > 0);

  useEffect(() => {
    if (downloadProgressKey.length > 0) {
      if (
        hadDownloadTasksRef.current &&
        previousDownloadProgressKeyRef.current !== downloadProgressKey
      ) {
        void getLibrary();
      }
      hadDownloadTasksRef.current = true;
    } else if (hadDownloadTasksRef.current) {
      hadDownloadTasksRef.current = false;
      void getLibrary();
    }

    previousDownloadProgressKeyRef.current = downloadProgressKey;
  }, [downloadProgressKey, getLibrary]);

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
    error,
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
    const novels = await getLibraryNovelsFromDb();

    setLibrary(novels);
  };

  useFocusEffect(
    useCallback(() => {
      getLibrary();
    }, []),
  );

  return { library, setLibrary };
};
