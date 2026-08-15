import { useCallback } from 'react';
import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';
import {
  bookmarkChaptersAction,
  deleteChapterAction,
  deleteChaptersAction,
  markChapterReadAction,
  markChaptersReadAction,
  markChaptersUnreadAction,
  markPreviouschaptersReadAction,
  markPreviousChaptersUnreadAction,
  refreshChaptersAction,
  updateChapterProgressAction,
} from './store/chapterActions';
import { ChapterInfo, NovelInfo } from '@database/types';

export interface UseChapterOperationsParams {
  novel: NovelInfo | undefined;
  chapters: ChapterInfo[];
  _setChapters: React.Dispatch<React.SetStateAction<ChapterInfo[]>>;
  transformChapters: (chs: ChapterInfo[]) => ChapterInfo[];
  settingsSort: ChapterOrderKey;
  settingsFilter: ChapterFilterKey[];
  currentPage: string;
  fetching: boolean;
}

export const useChapterOperations = ({
  novel,
  _setChapters,
  transformChapters,
  settingsSort,
  settingsFilter,
  currentPage,
  fetching,
}: UseChapterOperationsParams) => {
  const mutateChapters = useCallback(
    (mutation: (chs: ChapterInfo[]) => ChapterInfo[]) => {
      if (novel) {
        _setChapters(mutation);
      }
    },
    [novel, _setChapters],
  );

  const updateChapter = useCallback(
    (index: number, update: Partial<ChapterInfo>) => {
      if (novel) {
        _setChapters(chs => {
          const next = [...chs];
          next[index] = { ...next[index], ...update };
          return next;
        });
      }
    },
    [novel, _setChapters],
  );

  const transformAndSetChapters = useCallback(
    async (chs: ChapterInfo[]) => {
      _setChapters(transformChapters(chs));
    },
    [transformChapters, _setChapters],
  );

  const extendChapters = useCallback(
    async (chs: ChapterInfo[]) => {
      _setChapters(prev => prev.concat(transformChapters(chs)));
    },
    [transformChapters, _setChapters],
  );

  const bookmarkChapters = useCallback(
    (chapterIds: number[]) => {
      bookmarkChaptersAction(chapterIds, mutateChapters);
    },
    [mutateChapters],
  );

  const markPreviouschaptersRead = useCallback(
    (chapterId: number) => {
      markPreviouschaptersReadAction(chapterId, novel, mutateChapters);
    },
    [mutateChapters, novel],
  );

  const markChapterRead = useCallback(
    (chapterId: number) => {
      markChapterReadAction(chapterId, mutateChapters);
    },
    [mutateChapters],
  );

  const updateChapterProgress = useCallback(
    (chapterId: number, progress: number) => {
      updateChapterProgressAction(chapterId, progress, mutateChapters);
    },
    [mutateChapters],
  );

  const markChaptersRead = useCallback(
    (chapterIds: number[]) => {
      markChaptersReadAction(chapterIds, mutateChapters);
    },
    [mutateChapters],
  );

  const markPreviousChaptersUnread = useCallback(
    (chapterId: number) => {
      markPreviousChaptersUnreadAction(chapterId, novel, mutateChapters);
    },
    [mutateChapters, novel],
  );

  const markChaptersUnread = useCallback(
    (chapterIds: number[]) => {
      markChaptersUnreadAction(chapterIds, mutateChapters);
    },
    [mutateChapters],
  );

  const deleteChapter = useCallback(
    (_chapter: ChapterInfo) => {
      deleteChapterAction(_chapter, novel, mutateChapters);
    },
    [mutateChapters, novel],
  );

  const deleteChapters = useCallback(
    (chapterIds: number[]) => {
      deleteChaptersAction(chapterIds, novel, mutateChapters);
    },
    [novel, mutateChapters],
  );

  const refreshChapters = useCallback(() => {
    refreshChaptersAction({
      novel,
      fetching,
      settingsSort,
      settingsFilter,
      currentPage,
      transformChapters,
      setChapters: _setChapters,
    });
  }, [
    novel,
    fetching,
    settingsSort,
    settingsFilter,
    currentPage,
    transformChapters,
    _setChapters,
  ]);

  return {
    mutateChapters,
    updateChapter,
    setChapters: transformAndSetChapters,
    extendChapters,
    bookmarkChapters,
    markPreviouschaptersRead,
    markChapterRead,
    markChaptersRead,
    markPreviousChaptersUnread,
    markChaptersUnread,
    updateChapterProgress,
    deleteChapter,
    deleteChapters,
    refreshChapters,
  };
};
