/* eslint-disable no-console */
import { useMMKVNumber, useMMKVObject } from 'react-native-mmkv';
import { ChapterInfo, NovelInfo } from '@database/types';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { TRACKED_NOVEL_PREFIX } from './useTrackedNovel';
import {
  getNovelByPath,
  deleteCachedNovels as _deleteCachedNovels,
  getCachedNovels as _getCachedNovels,
  insertNovelAndChapters,
} from '@database/queries/NovelQueries';
import {
  bookmarkChapter as _bookmarkChapter,
  markChapterRead as _markChapterRead,
  markChaptersRead as _markChaptersRead,
  markPreviuschaptersRead as _markPreviuschaptersRead,
  markPreviousChaptersUnread as _markPreviousChaptersUnread,
  markChaptersUnread as _markChaptersUnread,
  deleteChapter as _deleteChapter,
  deleteChapters as _deleteChapters,
  getPageChapters as _getPageChapters,
  insertChapters,
  getCustomPages,
  getChapterCount,
  getPageChaptersBatched,
  updateChapterProgress as _updateChapterProgress,
} from '@database/queries/ChapterQueries';
import { fetchNovel, fetchPage } from '@services/plugin/fetch';
import { showToast } from '@utils/showToast';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getString } from '@strings/translations';
import dayjs from 'dayjs';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import { NOVEL_STORAGE } from '@utils/Storages';
import { useAppSettings } from './useSettings';
import NativeFile from '@specs/NativeFile';
import { useLibraryContext } from '@components/Context/LibraryContext';

// #region constants

export const NOVEL_PAGE_INDEX_PREFIX = 'NOVEL_PAGE_INDEX_PREFIX';
export const NOVEL_SETTINSG_PREFIX = 'NOVEL_SETTINGS';
export const LAST_READ_PREFIX = 'LAST_READ_PREFIX';

const defaultNovelSettings: NovelSettings = {
  showChapterTitles: true,
};
const defaultPageIndex = 0;

// #endregion
// #region types

export interface NovelSettings {
  sort?: string;
  filter?: string;
  showChapterTitles?: boolean;
}

// #endregion
// #region definition useNovel

export const useNovel = (novelOrPath: string | NovelInfo, pluginId: string) => {
  const { switchNovelToLibrary } = useLibraryContext();
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(true);
  const [novel, setNovel] = useState<NovelInfo | undefined>(
    typeof novelOrPath === 'object' ? novelOrPath : undefined,
  );
  const [pages, setPages] = useState<string[]>(
    novel ? calculatePages(novel) : [],
  );

  const { defaultChapterSort } = useAppSettings();

  const novelPath = novel?.path ?? (novelOrPath as string);

  const [pageIndex = defaultPageIndex, setPageIndex] = useMMKVNumber(`
    ${NOVEL_PAGE_INDEX_PREFIX}_${pluginId}_${novelPath}
    `);
  const currentPage = pages[pageIndex];

  const [lastRead, setLastRead] = useMMKVObject<ChapterInfo>(
    `${LAST_READ_PREFIX}_${pluginId}_${novelPath}`,
  );
  const [novelSettings = defaultNovelSettings, setNovelSettings] =
    useMMKVObject<NovelSettings>(
      `${NOVEL_SETTINSG_PREFIX}_${pluginId}_${novelPath}`,
    );

  const [chapters, _setChapters] = useState<ChapterInfo[]>([]);
  const [batchInformation, setBatchInformation] = useState<{
    batch: number;
    total: number;
    totalChapters?: number;
  }>(
    typeof novelOrPath === 'object'
      ? {
          batch: 0,
          total: 0,
          totalChapters: getChapterCount(novelOrPath.id, pages[pageIndex]),
        }
      : { batch: 0, total: 0 },
  );

  const settingsSort = novelSettings.sort || defaultChapterSort;
  // #endregion
  // #region setters

  function calculatePages(tmpNovel: NovelInfo) {
    let tmpPages: string[];
    if (tmpNovel.totalPages > 0) {
      tmpPages = Array(tmpNovel.totalPages)
        .fill(0)
        .map((_, idx) => String(idx + 1));
    } else {
      tmpPages = getCustomPages(tmpNovel.id).map(c => c.page);
    }

    return tmpPages.length > 1 ? tmpPages : ['1'];
  }

  const mutateChapters = useCallback(
    (mutation: (chs: ChapterInfo[]) => ChapterInfo[]) => {
      if (novel) {
        _setChapters(mutation);
      }
    },
    [novel],
  );

  const updateChapter = useCallback(
    (index: number, update: Partial<ChapterInfo>) => {
      if (novel) {
        _setChapters(chs => {
          chs[index] = { ...chs[index], ...update };
          return chs;
        });
      }
    },
    [novel],
  );

  const openPage = useCallback(
    (index: number) => {
      setPageIndex(index);
    },
    [setPageIndex],
  );

  const transformChapters = useCallback(
    (chs: ChapterInfo[]) => {
      if (!novel) return chs;
      const newChapters = chs.map(chapter => {
        const parsedTime = dayjs(chapter.releaseTime);
        const releaseTime = parsedTime.isValid()
          ? parsedTime.format('LL')
          : chapter.releaseTime;
        const chapterNumber = chapter.chapterNumber
          ? chapter.chapterNumber
          : parseChapterNumber(novel.name, chapter.name);
        return {
          ...chapter,
          releaseTime,
          chapterNumber,
        };
      });
      return newChapters;
    },
    [novel],
  );

  const setChapters = useCallback(
    async (chs: ChapterInfo[]) => {
      _setChapters(transformChapters(chs));
    },
    [transformChapters],
  );

  const extendChapters = useCallback(
    async (chs: ChapterInfo[]) => {
      _setChapters(prev => prev.concat(transformChapters(chs)));
    },
    [transformChapters],
  );

  const sortAndFilterChapters = useCallback(
    async (sort?: string, filter?: string) => {
      if (novel) {
        setNovelSettings({
          showChapterTitles: novelSettings?.showChapterTitles,
          sort,
          filter,
        });
      }
    },
    [novel, novelSettings?.showChapterTitles, setNovelSettings],
  );

  const setShowChapterTitles = useCallback(
    (v: boolean) => {
      setNovelSettings({ ...novelSettings, showChapterTitles: v });
    },
    [novelSettings, setNovelSettings],
  );

  const followNovel = useCallback(() => {
    switchNovelToLibrary(novelPath, pluginId).then(() => {
      if (novel) {
        setNovel({
          ...novel,
          inLibrary: !novel?.inLibrary,
        });
      }
    });
  }, [novel, novelPath, pluginId, switchNovelToLibrary]);

  // #endregion
  // #region getters

  const getNovel = useCallback(async () => {
    let tmpNovel = getNovelByPath(novelPath, pluginId);
    if (!tmpNovel) {
      const sourceNovel = await fetchNovel(pluginId, novelPath).catch(() => {
        throw new Error(getString('updatesScreen.unableToGetNovel'));
      });

      await insertNovelAndChapters(pluginId, sourceNovel);
      tmpNovel = getNovelByPath(novelPath, pluginId);

      if (!tmpNovel) {
        return;
      }
    }
    setPages(calculatePages(tmpNovel));

    setNovel(tmpNovel);
  }, [novelPath, pluginId]);

  const getChapters = useCallback(async () => {
    const page = pages[pageIndex];

    if (novel && page) {
      let newChapters: ChapterInfo[] = [];

      const config = [
        novel.id,
        settingsSort,
        novelSettings.filter,
        page,
      ] as const;

      let chapterCount = getChapterCount(novel.id, page);

      if (chapterCount) {
        try {
          newChapters = getPageChaptersBatched(...config) || [];
        } catch (error) {
          console.error('teaser', error);
        }
      }
      // Fetch next page if no chapters
      else if (Number(page)) {
        _setChapters([]);
        const sourcePage = await fetchPage(pluginId, novelPath, page);
        const sourceChapters = sourcePage.chapters.map(ch => {
          return {
            ...ch,
            page,
          };
        });
        await insertChapters(novel.id, sourceChapters);
        newChapters = await _getPageChapters(...config);
        chapterCount = getChapterCount(novel.id, page);
      }

      setBatchInformation({
        batch: 0,
        total: Math.floor(chapterCount / 300),
        totalChapters: chapterCount,
      });
      setChapters(newChapters);
    }
  }, [
    novel,
    novelPath,
    novelSettings.filter,
    pageIndex,
    pages,
    pluginId,
    setChapters,
    settingsSort,
  ]);

  const getNextChapterBatch = useCallback(() => {
    const page = pages[pageIndex];
    const nextBatch = batchInformation.batch + 1;
    if (novel && page && nextBatch <= batchInformation.total) {
      let newChapters: ChapterInfo[] = [];

      try {
        newChapters =
          getPageChaptersBatched(
            novel.id,
            settingsSort,
            novelSettings.filter,
            page,
            nextBatch,
          ) || [];
      } catch (error) {
        console.error('teaser', error);
      }
      setBatchInformation({ ...batchInformation, batch: nextBatch });
      extendChapters(newChapters);
    }
  }, [
    batchInformation,
    extendChapters,
    novel,
    novelSettings.filter,
    pageIndex,
    pages,
    settingsSort,
  ]);

  const loadUpToBatch = useCallback(
    async (targetBatch: number) => {
      const page = pages[pageIndex];
      if (!novel || !page || targetBatch <= batchInformation.batch) {
        return;
      }

      // Load all batches from current + 1 up to targetBatch
      for (let batch = batchInformation.batch + 1; batch <= targetBatch; batch++) {
        if (batch > batchInformation.total) break;

        let newChapters: ChapterInfo[] = [];
        try {
          newChapters =
            getPageChaptersBatched(
              novel.id,
              settingsSort,
              novelSettings.filter,
              page,
              batch,
            ) || [];
        } catch (error) {
          console.error('Error loading batch', batch, error);
        }

        setBatchInformation(prev => ({ ...prev, batch }));
        extendChapters(newChapters);
      }
    },
    [
      batchInformation,
      extendChapters,
      novel,
      novelSettings.filter,
      pageIndex,
      pages,
      settingsSort,
    ],
  );

  // #endregion
  // #region Mark chapters

  const bookmarkChapters = useCallback(
    (_chapters: ChapterInfo[]) => {
      _chapters.map(_chapter => {
        _bookmarkChapter(_chapter.id);
      });
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
    },
    [mutateChapters],
  );

  const markPreviouschaptersRead = useCallback(
    (chapterId: number) => {
      if (novel) {
        _markPreviuschaptersRead(chapterId, novel.id);
        mutateChapters(chs =>
          chs.map(chapter =>
            chapter.id <= chapterId ? { ...chapter, unread: false } : chapter,
          ),
        );
      }
    },
    [mutateChapters, novel],
  );

  const markChapterRead = useCallback(
    (chapterId: number) => {
      _markChapterRead(chapterId);

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
    },
    [mutateChapters],
  );

  const updateChapterProgress = useCallback(
    (chapterId: number, progress: number) => {
      _updateChapterProgress(chapterId, Math.min(progress, 100));

      mutateChapters(chs =>
        chs.map(c => {
          if (c.id !== chapterId) {
            return c;
          }
          return {
            ...c,
            progress,
          };
        }),
      );
    },
    [mutateChapters],
  );

  const markChaptersRead = useCallback(
    (_chapters: ChapterInfo[]) => {
      const chapterIds = _chapters.map(chapter => chapter.id);
      _markChaptersRead(chapterIds);

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
    },
    [mutateChapters],
  );

  const markPreviousChaptersUnread = useCallback(
    (chapterId: number) => {
      if (novel) {
        _markPreviousChaptersUnread(chapterId, novel.id);
        mutateChapters(chs =>
          chs.map(chapter =>
            chapter.id <= chapterId ? { ...chapter, unread: true } : chapter,
          ),
        );
      }
    },
    [mutateChapters, novel],
  );

  const markChaptersUnread = useCallback(
    (_chapters: ChapterInfo[]) => {
      const chapterIds = _chapters.map(chapter => chapter.id);
      _markChaptersUnread(chapterIds);

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
    },
    [mutateChapters],
  );

  // #endregion
  // #region refresh and delete

  const deleteChapter = useCallback(
    (_chapter: ChapterInfo) => {
      if (novel) {
        _deleteChapter(novel.pluginId, novel.id, _chapter.id).then(() => {
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
          showToast(getString('common.deleted', { name: _chapter.name }));
        });
      }
    },
    [mutateChapters, novel],
  );

  const deleteChapters = useCallback(
    (_chaters: ChapterInfo[]) => {
      if (novel) {
        _deleteChapters(novel.pluginId, novel.id, _chaters).then(() => {
          showToast(
            getString('updatesScreen.deletedChapters', {
              num: _chaters.length,
            }),
          );
          mutateChapters(chs =>
            chs.map(chapter => {
              if (_chaters.some(_c => _c.id === chapter.id)) {
                return {
                  ...chapter,
                  isDownloaded: false,
                };
              }
              return chapter;
            }),
          );
        });
      }
    },
    [novel, mutateChapters],
  );

  const refreshChapters = useCallback(() => {
    if (novel?.id && !fetching) {
      _getPageChapters(
        novel.id,
        settingsSort,
        novelSettings.filter,
        currentPage,
      ).then(chs => {
        setChapters(chs);
      });
    }
  }, [
    novel?.id,
    fetching,
    settingsSort,
    novelSettings.filter,
    currentPage,
    setChapters,
  ]);

  // #endregion
  // #region useEffects

  useEffect(() => {
    if (novel) {
      setLoading(false);
    } else {
      getNovel().finally(() => {
        //? Sometimes loading state changes doesn't trigger rerender causing NovelScreen to be in endless loading state
        setLoading(false);
        // getNovel();
      });
    }
  }, [getNovel, novel]);

  useEffect(() => {
    if (novel === undefined) return;
    setFetching(true);
    getChapters()
      .catch(e => {
        if (__DEV__) console.error(e);

        showToast(e.message);
        setFetching(false);
      })
      .finally(() => {
        setFetching(false);
      });
  }, [getChapters, novel, novelOrPath]);

  // #endregion

  return useMemo(
    () => ({
      loading,
      fetching,
      pageIndex,
      pages,
      novel,
      lastRead,
      chapters,
      novelSettings,
      batchInformation,
      getNextChapterBatch,
      loadUpToBatch,
      getNovel,
      setPageIndex,
      openPage,
      setNovel,
      setLastRead,
      sortAndFilterChapters,
      followNovel,
      bookmarkChapters,
      markPreviouschaptersRead,
      markChapterRead,
      markChaptersRead,
      markPreviousChaptersUnread,
      markChaptersUnread,
      setShowChapterTitles,
      refreshChapters,
      updateChapter,
      updateChapterProgress,
      deleteChapter,
      deleteChapters,
    }),
    [
      loading,
      fetching,
      pageIndex,
      pages,
      novel,
      lastRead,
      chapters,
      novelSettings,
      batchInformation,
      getNextChapterBatch,
      loadUpToBatch,
      getNovel,
      setPageIndex,
      openPage,
      setLastRead,
      sortAndFilterChapters,
      followNovel,
      bookmarkChapters,
      markPreviouschaptersRead,
      markChapterRead,
      markChaptersRead,
      markPreviousChaptersUnread,
      markChaptersUnread,
      setShowChapterTitles,
      refreshChapters,
      updateChapter,
      updateChapterProgress,
      deleteChapter,
      deleteChapters,
    ],
  );
};

// #region DeleteCachedNovels

export const deleteCachedNovels = async () => {
  const cachedNovels = await _getCachedNovels();
  for (const novel of cachedNovels) {
    MMKVStorage.delete(`${TRACKED_NOVEL_PREFIX}_${novel.id}`);
    MMKVStorage.delete(
      `${NOVEL_PAGE_INDEX_PREFIX}_${novel.pluginId}_${novel.path}`,
    );
    MMKVStorage.delete(
      `${NOVEL_SETTINSG_PREFIX}_${novel.pluginId}_${novel.path}`,
    );
    MMKVStorage.delete(`${LAST_READ_PREFIX}_${novel.pluginId}_${novel.path}`);
    const novelDir = NOVEL_STORAGE + '/' + novel.pluginId + '/' + novel.id;
    if (NativeFile.exists(novelDir)) {
      NativeFile.unlink(novelDir);
    }
  }
  _deleteCachedNovels();
};
// #endregion
