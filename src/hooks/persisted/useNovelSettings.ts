import {
  ChapterFilterKey,
  ChapterFilterPositiveKey,
  ChapterOrderKey,
} from '@database/constants';
import { useCallback, useMemo, useRef } from 'react';
import { ChapterFilterObject, FilterStates } from '@database/utils/filter';
import {
  defaultNovelSettings,
  NOVEL_PAGE_INDEX_PREFIX,
  NOVEL_SETTINGS_PREFIX,
} from './useNovel/types';
import { useNovelAction, useNovelValue } from '@screens/novel/NovelContext';

export { NOVEL_PAGE_INDEX_PREFIX, NOVEL_SETTINGS_PREFIX };

export const useNovelSettings = () => {
  const novel = useNovelValue('novel');
  const domainNovelSettings = useNovelValue('novelSettings');
  const writeNovelSettings = useNovelAction('setNovelSettings');

  const novelSettings = useMemo(
    () => ({ ...defaultNovelSettings, ...domainNovelSettings }),
    [domainNovelSettings],
  );

  const _filter: ChapterFilterKey[] = novelSettings.filter;

  // #endregion
  // #region setters

  const setChapterSort = useCallback(
    async (sort: ChapterOrderKey) => {
      if (novel) {
        writeNovelSettings({
          ...novelSettings,
          sort,
        });
      }
    },
    [novel, writeNovelSettings, novelSettings],
  );
  const setChapterFilter = useCallback(
    async (filter?: ChapterFilterKey[]) => {
      if (novel) {
        writeNovelSettings({
          ...novelSettings,
          filter: filter ?? [],
        });
      }
    },
    [novel, writeNovelSettings, novelSettings],
  );

  const filterManager = useRef<ChapterFilterObject>(
    new ChapterFilterObject(_filter, setChapterFilter),
  );

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
      writeNovelSettings({ ...novelSettings, showChapterTitles: v });
    },
    [novelSettings, writeNovelSettings],
  );

  const setExcludedScanlators = useCallback(
    (excludedScanlators: string[]) => {
      if (novel) {
        writeNovelSettings({
          ...novelSettings,
          excludedScanlators,
        });
      }
    },
    [novel, writeNovelSettings, novelSettings],
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
      setExcludedScanlators,
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
      setExcludedScanlators,
    ],
  );
};
