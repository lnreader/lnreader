import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';
import {
  bookmarkChapters as _bookmarkChapters,
  deleteChapter as _deleteChapter,
  deleteChapters as _deleteChapters,
  getPageChapters as _getPageChapters,
  markChapterRead as _markChapterRead,
  markChaptersRead as _markChaptersRead,
  markChaptersUnread as _markChaptersUnread,
  markPreviousChaptersUnread as _markPreviousChaptersUnread,
  markPreviuschaptersRead as _markPreviuschaptersRead,
  updateChapterProgress as _updateChapterProgress,
  updateChapterProgressByIds as _updateChapterProgressByIds,
  increaseTimeSpent as _increaseTimeSpent,
} from '@database/queries/ChapterQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString as translateGetString } from '@i18n/translations';
import { showToast } from '@utils/showToast';

type MutateChapters = (mutation: (chs: ChapterInfo[]) => ChapterInfo[]) => void;
type SetChapters = (chs: ChapterInfo[]) => void;
type TransformChapters = (chs: ChapterInfo[]) => ChapterInfo[];

export interface ChapterActionsDependencies {
  bookmarkChapters: (chapterIds: number[]) => Promise<void>;
  markChapterRead: (chapterId: number) => Promise<void>;
  markChaptersRead: (chapterIds: number[]) => Promise<void>;
  markPreviuschaptersRead: (
    chapterId: number,
    novelId: number,
  ) => Promise<void>;
  markPreviousChaptersUnread: (
    chapterId: number,
    novelId: number,
  ) => Promise<void>;
  markChaptersUnread: (chapterIds: number[]) => Promise<void>;
  updateChapterProgress: (chapterId: number, progress: number) => Promise<void>;
  updateChapterProgressByIds: (
    chapterIds: number[],
    progress: number,
  ) => Promise<void>;
  deleteChapter: (
    pluginId: string,
    novelId: number,
    chapterId: number,
  ) => Promise<void>;
  deleteChapters: (
    pluginId: string,
    novelId: number,
    chapterIds?: number[],
  ) => Promise<void>;
  getPageChapters: (
    novelId: number,
    sort?: ChapterOrderKey,
    filter?: ChapterFilterKey[],
    page?: string,
  ) => Promise<ChapterInfo[]>;
  increaseTimeSpent: (chapterId: number, timeSpent: number) => Promise<void>;
  showToast: (message: string) => void;
  getString: typeof translateGetString;
}

export const defaultChapterActionsDependencies: ChapterActionsDependencies = {
  bookmarkChapters: _bookmarkChapters,
  markChapterRead: _markChapterRead,
  markChaptersRead: _markChaptersRead,
  markPreviuschaptersRead: _markPreviuschaptersRead,
  markPreviousChaptersUnread: _markPreviousChaptersUnread,
  markChaptersUnread: _markChaptersUnread,
  updateChapterProgress: _updateChapterProgress,
  updateChapterProgressByIds: _updateChapterProgressByIds,
  deleteChapter: _deleteChapter,
  deleteChapters: _deleteChapters,
  getPageChapters: _getPageChapters,
  increaseTimeSpent: _increaseTimeSpent,
  showToast,
  getString: translateGetString,
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const runAsyncAction = (
  promise: Promise<unknown>,
  deps: ChapterActionsDependencies,
) => {
  promise.catch(error => {
    deps.showToast(getErrorMessage(error));
  });
};

export const bookmarkChaptersAction = (
  chapterIds: number[],
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  const chapterIdSet = new Set(chapterIds);
  runAsyncAction(deps.bookmarkChapters(chapterIds), deps);

  mutateChapters(chs =>
    chs.map(chapter => {
      if (chapterIdSet.has(chapter.id)) {
        return {
          ...chapter,
          bookmark: !chapter.bookmark,
        };
      }
      return chapter;
    }),
  );
};

export const markPreviouschaptersReadAction = (
  chapterId: number,
  novel: NovelInfo | undefined,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  if (novel) {
    runAsyncAction(deps.markPreviuschaptersRead(chapterId, novel.id), deps);
    mutateChapters(chs =>
      chs.map(chapter =>
        chapter.id <= chapterId ? { ...chapter, unread: false } : chapter,
      ),
    );
  }
};

export const markChapterReadAction = (
  chapterId: number,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  runAsyncAction(deps.markChapterRead(chapterId), deps);

  mutateChapters(chs => {
    // Reaching the end of a chapter marks it read on every progress report.
    if (!chs.some(c => c.id === chapterId && c.unread)) {
      return chs;
    }

    return chs.map(c => {
      if (c.id !== chapterId) {
        return c;
      }

      return {
        ...c,
        unread: false,
      };
    });
  });
};

export const markChaptersReadAction = (
  chapterIds: number[],
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  const chapterIdSet = new Set(chapterIds);
  runAsyncAction(deps.markChaptersRead(chapterIds), deps);

  mutateChapters(chs =>
    chs.map(chapter => {
      if (chapterIdSet.has(chapter.id)) {
        return {
          ...chapter,
          unread: false,
        };
      }
      return chapter;
    }),
  );
};

export const markPreviousChaptersUnreadAction = (
  chapterId: number,
  novel: NovelInfo | undefined,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  if (novel) {
    runAsyncAction(deps.markPreviousChaptersUnread(chapterId, novel.id), deps);
    mutateChapters(chs =>
      chs.map(chapter =>
        chapter.id <= chapterId ? { ...chapter, unread: true } : chapter,
      ),
    );
  }
};

export const markChaptersUnreadAction = (
  chapterIds: number[],
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  const chapterIdSet = new Set(chapterIds);
  runAsyncAction(deps.markChaptersUnread(chapterIds), deps);

  mutateChapters(chs =>
    chs.map(chapter => {
      if (chapterIdSet.has(chapter.id)) {
        return {
          ...chapter,
          unread: true,
        };
      }
      return chapter;
    }),
  );
};

export const markChaptersUnreadAndResetProgressAction = async (
  chapterIds: number[],
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
): Promise<boolean> => {
  const chapterIdSet = new Set(chapterIds);

  try {
    await Promise.all([
      deps.markChaptersUnread(chapterIds),
      deps.updateChapterProgressByIds(chapterIds, 0),
    ]);
    mutateChapters(current =>
      current.map(chapter =>
        chapterIdSet.has(chapter.id)
          ? { ...chapter, unread: true, progress: 0 }
          : chapter,
      ),
    );
    return true;
  } catch (error) {
    deps.showToast(getErrorMessage(error));
    return false;
  }
};

export const updateChapterProgressAction = (
  chapterId: number,
  progress: number,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  const normalizedProgress = Math.min(progress, 100);
  runAsyncAction(
    deps.updateChapterProgress(chapterId, normalizedProgress),
    deps,
  );

  mutateChapters(chs => {
    // The reader reports progress continuously while scrolling. Keeping the
    // same array when nothing changed spares every chapter list subscribed to
    // the store a re-render.
    if (
      !chs.some(c => c.id === chapterId && c.progress !== normalizedProgress)
    ) {
      return chs;
    }

    return chs.map(c => {
      if (c.id !== chapterId) {
        return c;
      }

      return {
        ...c,
        progress: normalizedProgress,
      };
    });
  });
};

export const deleteChapterAction = (
  _chapter: ChapterInfo,
  novel: NovelInfo | undefined,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  if (novel) {
    runAsyncAction(
      (async () => {
        await deps.deleteChapter(novel.pluginId, novel.id, _chapter.id);
        mutateChapters(chs =>
          chs.map(chapter => {
            if (chapter.id !== _chapter.id) {
              return chapter;
            }

            return {
              ...chapter,
              isDownloaded: false,
            };
          }),
        );

        deps.showToast(
          deps.getString('common.deleted', { name: _chapter.name }),
        );
      })(),
      deps,
    );
  }
};

export const deleteChaptersAction = (
  chapterIds: number[],
  novel: NovelInfo | undefined,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  if (novel) {
    const chapterIdSet = new Set(chapterIds);
    runAsyncAction(
      (async () => {
        await deps.deleteChapters(novel.pluginId, novel.id, chapterIds);
        deps.showToast(
          deps.getString('updatesScreen.deletedChapters', {
            num: chapterIds.length,
          }),
        );

        mutateChapters(chs =>
          chs.map(chapter => {
            if (chapterIdSet.has(chapter.id)) {
              return {
                ...chapter,
                isDownloaded: false,
              };
            }
            return chapter;
          }),
        );
      })(),
      deps,
    );
  }
};

export interface RefreshChaptersParams {
  novel: NovelInfo | undefined;
  fetching: boolean;
  settingsSort: ChapterOrderKey;
  settingsFilter: ChapterFilterKey[];
  currentPage: string;
  transformChapters: TransformChapters;
  setChapters: SetChapters;
  deps?: ChapterActionsDependencies;
}

export const refreshChaptersAction = ({
  novel,
  fetching,
  settingsSort,
  settingsFilter,
  currentPage,
  transformChapters,
  setChapters,
  deps = defaultChapterActionsDependencies,
}: RefreshChaptersParams) => {
  if (novel?.id && !fetching) {
    runAsyncAction(
      deps
        .getPageChapters(novel.id, settingsSort, settingsFilter, currentPage)
        .then(chs => {
          setChapters(transformChapters(chs));
        }),
      deps,
    );
  }
};

/**
 * Persists reading time only. The reader reports it every few seconds for as
 * long as a chapter is open, and mirroring it into the in-memory chapter list
 * would rebuild that list (and re-render every screen showing it) on each
 * report - for a field no screen renders: the statistics screen aggregates
 * `timeSpent` straight from the database.
 */
export function increaseTimeSpentAction(
  chapterId: number,
  timeSpent: number,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) {
  runAsyncAction(deps.increaseTimeSpent(chapterId, timeSpent), deps);
}
