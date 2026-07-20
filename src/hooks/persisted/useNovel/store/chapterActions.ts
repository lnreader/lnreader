import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';
import {
  bookmarkChapter as _bookmarkChapter,
  deleteChapter as _deleteChapter,
  deleteChapters as _deleteChapters,
  getPageChapters as _getPageChapters,
  markChapterRead as _markChapterRead,
  markChaptersRead as _markChaptersRead,
  markChaptersUnread as _markChaptersUnread,
  markPreviousChaptersUnread as _markPreviousChaptersUnread,
  markPreviuschaptersRead as _markPreviuschaptersRead,
  updateChapterProgress as _updateChapterProgress,
  increaseTimeSpent as _increaseTimeSpent,
} from '@database/queries/ChapterQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString as translateGetString } from '@strings/translations';
import { showToast } from '@utils/showToast';

type MutateChapters = (mutation: (chs: ChapterInfo[]) => ChapterInfo[]) => void;
type SetChapters = (chs: ChapterInfo[]) => void;
type TransformChapters = (chs: ChapterInfo[]) => ChapterInfo[];

export interface ChapterActionsDependencies {
  bookmarkChapter: (chapterId: number) => Promise<void>;
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
  deleteChapter: (
    pluginId: string,
    novelId: number,
    chapterId: number,
  ) => Promise<void>;
  deleteChapters: (
    pluginId: string,
    novelId: number,
    chapters?: ChapterInfo[],
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
  bookmarkChapter: _bookmarkChapter,
  markChapterRead: _markChapterRead,
  markChaptersRead: _markChaptersRead,
  markPreviuschaptersRead: _markPreviuschaptersRead,
  markPreviousChaptersUnread: _markPreviousChaptersUnread,
  markChaptersUnread: _markChaptersUnread,
  updateChapterProgress: _updateChapterProgress,
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
  _chapters: ChapterInfo[],
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  runAsyncAction(
    Promise.all(_chapters.map(_chapter => deps.bookmarkChapter(_chapter.id))),
    deps,
  );

  mutateChapters(chs =>
    chs.map(chapter => {
      if (_chapters.some(_c => _c.id === chapter.id)) {
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

  mutateChapters(chs =>
    chs.map(c => {
      if (c.id !== chapterId) {
        return c;
      }

      return {
        ...c,
        unread: false,
      };
    }),
  );
};

export const markChaptersReadAction = (
  _chapters: ChapterInfo[],
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  const chapterIds = _chapters.map(chapter => chapter.id);
  runAsyncAction(deps.markChaptersRead(chapterIds), deps);

  mutateChapters(chs =>
    chs.map(chapter => {
      if (chapterIds.includes(chapter.id)) {
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
  _chapters: ChapterInfo[],
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  const chapterIds = _chapters.map(chapter => chapter.id);
  runAsyncAction(deps.markChaptersUnread(chapterIds), deps);

  mutateChapters(chs =>
    chs.map(chapter => {
      if (chapterIds.includes(chapter.id)) {
        return {
          ...chapter,
          unread: true,
        };
      }
      return chapter;
    }),
  );
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

  mutateChapters(chs =>
    chs.map(c => {
      if (c.id !== chapterId) {
        return c;
      }

      return {
        ...c,
        progress: normalizedProgress,
      };
    }),
  );
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
  _chapters: ChapterInfo[],
  novel: NovelInfo | undefined,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) => {
  if (novel) {
    runAsyncAction(
      (async () => {
        await deps.deleteChapters(novel.pluginId, novel.id, _chapters);
        deps.showToast(
          deps.getString('updatesScreen.deletedChapters', {
            num: _chapters.length,
          }),
        );

        mutateChapters(chs =>
          chs.map(chapter => {
            if (_chapters.some(_c => _c.id === chapter.id)) {
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

export function increaseTimeSpentAction(
  chapterId: number,
  timeSpent: number,
  mutateChapters: MutateChapters,
  deps: ChapterActionsDependencies = defaultChapterActionsDependencies,
) {
  runAsyncAction(
    deps.increaseTimeSpent(chapterId, timeSpent),
    deps,
  );

  mutateChapters(chapters =>
    chapters.map(ch =>
      ch.id === chapterId
        ? {
          ...ch, timeSpent: (ch.timeSpent ?? 0) + timeSpent
        }
        : ch
    )
  );
}
