/* eslint-disable no-console */
import { useMMKVObject } from 'react-native-mmkv';
import {
  ChapterFilterKey,
  ChapterFilterPositiveKey,
  ChapterOrderKey,
} from '@database/constants';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useAppSettings } from './useSettings';
import { ChapterFilterObject, FilterStates } from '@database/utils/filter';
import { useNovelContext } from '@screens/novel/NovelContext';

// #region constants

export const NOVEL_PAGE_INDEX_PREFIX = 'NOVEL_PAGE_INDEX_PREFIX';
export const NOVEL_SETTINSG_PREFIX = 'NOVEL_SETTINGS';
export const LAST_READ_PREFIX = 'LAST_READ_PREFIX';

const defaultNovelSettings: NovelSettings = {
  showChapterTitles: true,
  filter: [],
};

// #endregion
// #region types

export interface NovelSettings {
  sort?: ChapterOrderKey;
  filter: ChapterFilterKey[];
  showChapterTitles?: boolean;
}

// #endregion
// #region definition useNovel

export const useNovelSettings = () => {
  const { novel } = useNovelContext();
  const { defaultChapterSort } = useAppSettings();

  const [ns, setNovelSettings] = useMMKVObject<NovelSettings>(
    `${NOVEL_SETTINSG_PREFIX}_${novel?.pluginId}_${novel?.path}`,
  );
  const novelSettings = useMemo(
    () => ({ ...defaultNovelSettings, ...ns }),
    [ns],
  );

  const _sort: ChapterOrderKey = novelSettings.sort ?? defaultChapterSort;
  const _filter: ChapterFilterKey[] = novelSettings.filter;
  const filterManager = useRef<ChapterFilterObject | null>(null);

  // #endregion
  // #region setters

  const setChapterSort = useCallback(
    async (sort?: ChapterOrderKey) => {
      if (novel) {
        setNovelSettings({
          showChapterTitles: novelSettings?.showChapterTitles,
          sort,
          filter: _filter,
        });
      }
    },
    [novel, setNovelSettings, novelSettings?.showChapterTitles, _filter],
  );
  const setChapterFilter = useCallback(
    async (filter?: ChapterFilterKey[]) => {
      if (novel) {
        setNovelSettings({
          showChapterTitles: novelSettings?.showChapterTitles,
          sort: _sort,
          filter: filter ?? [],
        });
      }
    },
    [novel, setNovelSettings, novelSettings?.showChapterTitles, _sort],
  );
  useEffect(() => {
    if (!filterManager.current) {
      filterManager.current = new ChapterFilterObject(
        _filter,
        setChapterFilter,
      );
    }
  }, [_filter, setChapterFilter]);

  const cycleChapterFilter = useCallback(
    (key: ChapterFilterPositiveKey) => {
      filterManager.current?.cycle(key);
    }, // eslint-disable-next-line react-hooks/exhaustive-deps
    [_filter],
  );

  const setChapterFilterValue = useCallback(
    (key: ChapterFilterPositiveKey, value: keyof FilterStates) => {
      filterManager.current?.set(key, value);
    }, // eslint-disable-next-line react-hooks/exhaustive-deps
    [_filter],
  );

  const getChapterFilterState = useCallback(
    (key: ChapterFilterPositiveKey) => {
      return filterManager.current?.state(key) ?? false;
    }, // eslint-disable-next-line react-hooks/exhaustive-deps
    [_filter],
  );

  const getChapterFilter = useCallback(
    (key: ChapterFilterPositiveKey) => filterManager.current?.get(key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [_filter],
  );

  const setShowChapterTitles = useCallback(
    (v: boolean) => {
      setNovelSettings({ ...novelSettings, showChapterTitles: v });
    },
    [novelSettings, setNovelSettings],
  );

  // #endregion

  return useMemo(
    () => ({
      ...novelSettings,
      cycleChapterFilter,
      setChapterFilter,
      setChapterFilterValue,
      getChapterFilterState,
      getChapterFilter,
      setChapterSort,
      setShowChapterTitles,
    }),
    [
      cycleChapterFilter,
      getChapterFilter,
      getChapterFilterState,
      novelSettings,
      setChapterFilter,
      setChapterFilterValue,
      setChapterSort,
      setShowChapterTitles,
    ],
  );
};
