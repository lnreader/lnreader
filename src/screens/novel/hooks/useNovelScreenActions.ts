import { useCallback } from 'react';
import { Share } from 'react-native';
import isNumber from 'lodash-es/isNumber';

import {
  getAllUndownloadedAndUnreadChapters,
  getAllUndownloadedChapters,
  getChaptersByIds,
  getNovelDownloadedChapters,
} from '@database/queries/ChapterQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import { useDownload } from '@hooks/persisted';
import { resolveUrl } from '@services/plugin/fetch';
import { getErrorMessage } from '@utils/error';
import { showToast } from '@utils/showToast';

import { useNovelActions } from '../NovelContext';

interface UseNovelScreenActionsOptions {
  chapters: ChapterInfo[];
  novel?: NovelInfo;
}

export const useNovelScreenActions = ({
  chapters,
  novel,
}: UseNovelScreenActionsOptions) => {
  const {
    bookmarkChapters,
    deleteChapters,
    markChaptersRead,
    markChaptersUnreadAndResetProgress,
    markPreviouschaptersRead,
    markPreviousChaptersUnread,
  } = useNovelActions();
  const { downloadChapters } = useDownload();

  const downloadAvailableChapters = useCallback(
    async (amount: number | 'all' | 'unread') => {
      if (!novel) {
        return;
      }

      let availableChapters = chapters;
      if (amount === 'all') {
        availableChapters = await getAllUndownloadedChapters(novel.id);
      } else if (amount === 'unread') {
        availableChapters = await getAllUndownloadedAndUnreadChapters(novel.id);
      } else if (isNumber(amount)) {
        availableChapters = availableChapters
          .filter(chapter => !chapter.isDownloaded)
          .slice(0, amount);
      }

      if (availableChapters.length > 0) {
        downloadChapters(novel, availableChapters);
      }
    },
    [chapters, downloadChapters, novel],
  );

  const deleteDownloadedChapters = useCallback(() => {
    if (!novel) {
      return;
    }

    // The list on screen only holds the chapters loaded so far, so asking the
    // database is the only way to delete every download of a long novel.
    getNovelDownloadedChapters(novel.id)
      .then(downloaded => {
        if (downloaded.length > 0) {
          deleteChapters(downloaded.map(chapter => chapter.id));
        }
      })
      .catch(error => showToast(getErrorMessage(error)));
  }, [deleteChapters, novel]);

  const shareNovel = useCallback(() => {
    if (novel) {
      void Share.share({
        message: resolveUrl(novel.pluginId, novel.path, true),
      });
    }
  }, [novel]);

  const runSelectionAction = useCallback(
    async (action: string, ids: readonly number[], chapterId?: number) => {
      if (!novel || ids.length === 0) return;
      const selectedIds = [...ids];
      switch (action) {
        case 'selection-download-outline': {
          const rows = await getChaptersByIds(selectedIds);
          const available = rows.filter(chapter => !chapter.isDownloaded);
          if (available.length > 0) downloadChapters(novel, available);
          break;
        }
        case 'selection-trash-can-outline': {
          const rows = await getChaptersByIds(selectedIds);
          const downloadedIds = rows
            .filter(chapter => chapter.isDownloaded)
            .map(chapter => chapter.id);
          if (downloadedIds.length > 0) await deleteChapters(downloadedIds);
          break;
        }
        case 'selection-bookmark-outline':
          await bookmarkChapters(selectedIds);
          break;
        case 'selection-check':
          await markChaptersRead(selectedIds);
          break;
        case 'selection-check-outline':
          await markChaptersUnreadAndResetProgress(selectedIds);
          break;
        case 'selection-playlist-check':
          if (chapterId !== undefined) {
            await markPreviouschaptersRead(chapterId);
          }
          break;
        case 'selection-playlist-remove':
          if (chapterId !== undefined) {
            await markPreviousChaptersUnread(chapterId);
          }
          break;
      }
    },
    [
      novel,
      downloadChapters,
      deleteChapters,
      bookmarkChapters,
      markChaptersRead,
      markChaptersUnreadAndResetProgress,
      markPreviouschaptersRead,
      markPreviousChaptersUnread,
    ],
  );

  return {
    deleteDownloadedChapters,
    downloadAvailableChapters,
    downloadChapters,
    runSelectionAction,
    shareNovel,
  };
};
