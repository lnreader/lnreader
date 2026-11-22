import { useMemo, useRef, useState } from 'react';
import glyphs from '@react-native-vector-icons/material-design-icons/glyphmaps/MaterialDesignIcons.json';
import type {
  ChapterJumpPanel,
  ChapterJumpResult,
  ChapterSettingsPanel,
  NovelActionEvent,
} from '@modules/nitro-chapter-list';
import {
  CHAPTER_FILTER,
  CHAPTER_ORDER,
  type ChapterFilterKey,
  type ChapterOrderKey,
} from '@database/constants';
import {
  getChapter,
  getNovelChaptersByName,
  getNovelChaptersByNumber,
  getPageChapterIds,
} from '@database/queries/ChapterQueries';
import type { ChapterInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { formatDate } from '@utils/dateFormat';
import { getErrorMessage } from '@utils/error';
import { showToast } from '@utils/showToast';
import { useNovelStoreApi } from '../NovelContext';
import type { NovelSettings } from '@hooks/persisted/useNovel/types';

interface Options {
  novelId?: number;
  settings: NovelSettings;
  scanlators?: readonly string[];
  totalChapters?: number;
  dateFormat: Parameters<typeof formatDate>[1];
  relativeTimestamps: boolean;
  onOpenChapter: (chapter: ChapterInfo) => void;
}

export const useNativeChapterControls = ({
  novelId,
  settings,
  scanlators,
  totalChapters,
  dateFormat,
  relativeTimestamps,
  onOpenChapter,
}: Options) => {
  const store = useNovelStoreApi();
  const [jumpResult, setJumpResult] = useState<ChapterJumpResult>();
  const request = useRef(0);
  const matches = useRef(new Map<number, ChapterInfo>());
  const sortedScanlators = useMemo(
    () =>
      [...(scanlators ?? [])].sort((left, right) => left.localeCompare(right)),
    [scanlators],
  );
  const chapterSettings: ChapterSettingsPanel = {
    tabs: [
      getString('common.filter'),
      getString('common.sort'),
      getString('common.display'),
    ],
    labels: {
      downloaded: getString('novelScreen.bottomSheet.filters.downloaded'),
      read: getString('novelScreen.bottomSheet.filters.unread'),
      bookmarked: getString('novelScreen.bottomSheet.filters.bookmarked'),
      scanlators: getString('novelScreen.bottomSheet.filters.scanlators'),
      position: getString('novelScreen.bottomSheet.order.bySource'),
      name: getString('novelScreen.bottomSheet.order.byChapterName'),
      sourceTitle: getString('novelScreen.bottomSheet.displays.sourceTitle'),
      chapterNumber: getString(
        'novelScreen.bottomSheet.displays.chapterNumber',
      ),
      submit: getString('common.submit'),
      cancel: getString('common.cancel'),
      reset: getString('common.reset'),
    },
    glyphs: {
      off: String.fromCodePoint(glyphs['checkbox-blank-outline']),
      on: String.fromCodePoint(glyphs['checkbox-marked']),
      partial: String.fromCodePoint(glyphs['minus-box']),
      asc: String.fromCodePoint(glyphs['arrow-up']),
      desc: String.fromCodePoint(glyphs['arrow-down']),
      next: String.fromCodePoint(glyphs['chevron-right']),
    },
    filters: settings.filter,
    sort: settings.sort,
    showTitles: settings.showChapterTitles ?? false,
    scanlators: sortedScanlators,
    excludedScanlators: settings.excludedScanlators ?? [],
  };
  const chapterJump: ChapterJumpPanel = {
    labels: {
      title: getString('novelScreen.jumpToChapterModal.jumpToChapter'),
      description: getString('novelScreen.jumpToChapterModal.description'),
      name: getString('novelScreen.jumpToChapterModal.chapterName'),
      number: getString('novelScreen.jumpToChapterModal.chapterNumber'),
      byName: getString('novelScreen.jumpToChapterModal.searchByName'),
      open: getString('novelScreen.jumpToChapterModal.openChapter'),
      cancel: getString('common.cancel'),
      search: getString('common.search'),
      invalidName: getString(
        'novelScreen.jumpToChapterModal.error.validChapterName',
      ),
      invalidNumber: getString(
        'novelScreen.jumpToChapterModal.error.validChapterNumber',
      ),
    },
    maxNumber: totalChapters,
  };

  const changeSettings = (
    action: string,
    value?: string,
    values?: string[],
  ) => {
    const { actions, novel, novelSettings } = store.getState();
    if (novel?.id !== novelId || novelId === undefined) return;
    switch (action) {
      case 'chapter-settings-filter':
        if (values) {
          actions.setNovelSettings({
            ...novelSettings,
            filter: values.filter((key): key is ChapterFilterKey =>
              Object.hasOwn(CHAPTER_FILTER, key),
            ),
          });
        }
        break;
      case 'chapter-settings-sort':
        if (value && Object.hasOwn(CHAPTER_ORDER, value)) {
          actions.setNovelSettings({
            ...novelSettings,
            sort: value as ChapterOrderKey,
          });
        }
        break;
      case 'chapter-settings-display':
        actions.setNovelSettings({
          ...novelSettings,
          showChapterTitles: value === 'title',
        });
        break;
      case 'chapter-settings-scanlators':
        if (values) {
          actions.setNovelSettings({
            ...novelSettings,
            excludedScanlators: values,
          });
        }
        break;
    }
  };

  const search = async (requestId: number, value: string, byName: boolean) => {
    request.current = requestId;
    matches.current.clear();
    const query = value.trim();
    const number = Number(query);
    const maxNumber =
      totalChapters && totalChapters > 0 ? totalChapters : undefined;
    const numberError = `${chapterJump.labels.invalidNumber} (${
      maxNumber ? `1–${maxNumber}` : '≥ 1'
    })`;
    try {
      let rows: ChapterInfo[] = [];
      if (novelId !== undefined) {
        if (byName && query) {
          rows = await getNovelChaptersByName(novelId, query.toLowerCase());
        } else if (
          !byName &&
          Number.isInteger(number) &&
          number >= 1 &&
          (!maxNumber || number <= maxNumber)
        ) {
          rows = await getNovelChaptersByNumber(novelId, number);
        }
      }
      if (
        request.current !== requestId ||
        store.getState().novel?.id !== novelId
      ) {
        return;
      }
      const results = byName ? rows : rows.slice(0, 1);
      matches.current = new Map(results.map(chapter => [chapter.id, chapter]));
      setJumpResult({
        requestId,
        ...(results.length
          ? {
              matches: results.map(chapter => ({
                id: chapter.id,
                title: chapter.name,
                date: chapter.releaseTime
                  ? formatDate(
                      chapter.releaseTime,
                      dateFormat,
                      relativeTimestamps,
                    )
                  : undefined,
              })),
            }
          : { error: byName ? chapterJump.labels.invalidName : numberError }),
      });
    } catch (error) {
      if (request.current === requestId) {
        setJumpResult({ requestId, error: getErrorMessage(error) });
      }
    }
  };

  const scroll = async (requestId: number, chapterId: number) => {
    if (novelId === undefined || request.current !== requestId) return;
    try {
      const { novel, novelSettings, pages, pageIndex } = store.getState();
      if (novel?.id !== novelId) return;
      const ids = await getPageChapterIds(
        novelId,
        novelSettings.filter,
        pages[pageIndex],
        novelSettings.excludedScanlators,
        novelSettings.sort,
      );
      const latest = store.getState();
      if (
        request.current !== requestId ||
        latest.novel?.id !== novelId ||
        latest.novelSettings !== novelSettings ||
        latest.pages[latest.pageIndex] !== pages[pageIndex]
      ) {
        return;
      }
      const index = ids.indexOf(chapterId);
      setJumpResult({
        requestId,
        ...(index >= 0
          ? { index }
          : { error: chapterJump.labels.invalidNumber }),
      });
    } catch (error) {
      if (request.current === requestId) {
        setJumpResult({ requestId, error: getErrorMessage(error) });
      }
    }
  };

  const handle = ({
    action,
    value,
    values,
    requestId,
    byName,
    chapterId,
  }: NovelActionEvent): boolean => {
    if (action.startsWith('chapter-settings-')) {
      changeSettings(action, value, values);
      return true;
    }
    if (action === 'chapter-jump-search' && requestId !== undefined) {
      void search(requestId, value ?? '', byName === true);
      return true;
    }
    if (
      action === 'chapter-jump-scroll' &&
      requestId !== undefined &&
      chapterId !== undefined
    ) {
      void scroll(requestId, chapterId);
      return true;
    }
    if (
      action === 'chapter-jump-open' &&
      requestId === request.current &&
      novelId !== undefined &&
      store.getState().novel?.id === novelId &&
      chapterId !== undefined
    ) {
      const cached = matches.current.get(chapterId);
      if (cached) {
        onOpenChapter(cached);
      } else {
        void getChapter(chapterId)
          .then(chapter => {
            if (
              chapter &&
              chapter.novelId === novelId &&
              request.current === requestId &&
              store.getState().novel?.id === novelId
            ) {
              onOpenChapter(chapter);
            }
          })
          .catch(error => showToast(getErrorMessage(error)));
      }
      return true;
    }
    return false;
  };

  return {
    chapterSettings: novelId === undefined ? undefined : chapterSettings,
    chapterJump: novelId === undefined ? undefined : chapterJump,
    jumpResult,
    handle,
  };
};
