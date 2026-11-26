import { useCallback, useMemo } from 'react';
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
import { MaterialDesignIconName } from '@type/icon';

import { useNovelActions } from '../NovelContext';

type SelectionAction = {
  icon: MaterialDesignIconName;
  onPress: () => void;
};

interface UseNovelScreenActionsOptions {
  /** The first `limit` undownloaded chapters of the list, loaded or not. */
  getUndownloadedChapters: (limit: number) => Promise<ChapterInfo[]>;
  clearSelection: () => void;
  novel?: NovelInfo;
  selectedIds: number[];
  selectedChapters: ChapterInfo[];
}

export const useNovelScreenActions = ({
  getUndownloadedChapters,
  clearSelection,
  novel,
  selectedIds,
  selectedChapters,
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

      let availableChapters: ChapterInfo[] = [];
      if (amount === 'all') {
        availableChapters = await getAllUndownloadedChapters(novel.id);
      } else if (amount === 'unread') {
        availableChapters = await getAllUndownloadedAndUnreadChapters(novel.id);
      } else if (isNumber(amount)) {
        availableChapters = await getUndownloadedChapters(amount);
      }

      if (availableChapters.length > 0) {
        downloadChapters(novel, availableChapters);
      }
    },
    [downloadChapters, getUndownloadedChapters, novel],
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

  const selectionActions = useMemo(() => {
    const actions: SelectionAction[] = [];
    const finish = (action: () => void) => () => {
      action();
      clearSelection();
    };

    const hasUnloadedSelection = selectedIds.length > selectedChapters.length;

    if (
      !novel?.isLocal &&
      (hasUnloadedSelection ||
        selectedChapters.some(chapter => !chapter.isDownloaded))
    ) {
      actions.push({
        icon: 'download-outline',
        onPress: finish(() => {
          if (novel) {
            void getChaptersByIds(selectedIds).then(chaptersToDownload => {
              const availableChapters = chaptersToDownload.filter(
                chapter => !chapter.isDownloaded,
              );
              if (availableChapters.length > 0) {
                downloadChapters(novel, availableChapters);
              }
            });
          }
        }),
      });
    }

    if (
      !novel?.isLocal &&
      (hasUnloadedSelection ||
        selectedChapters.some(chapter => chapter.isDownloaded))
    ) {
      actions.push({
        icon: 'trash-can-outline',
        onPress: finish(() => {
          void getChaptersByIds(selectedIds).then(selectedChapterRows => {
            const downloadedChapterIds = selectedChapterRows
              .filter(chapter => chapter.isDownloaded)
              .map(chapter => chapter.id);
            if (downloadedChapterIds.length > 0) {
              deleteChapters(downloadedChapterIds);
            }
          });
        }),
      });
    }

    actions.push({
      icon: 'bookmark-outline',
      onPress: finish(() => bookmarkChapters(selectedIds)),
    });

    if (
      hasUnloadedSelection ||
      selectedChapters.some(chapter => chapter.unread)
    ) {
      actions.push({
        icon: 'check',
        onPress: finish(() => markChaptersRead(selectedIds)),
      });
    }

    if (
      hasUnloadedSelection ||
      selectedChapters.some(chapter => !chapter.unread)
    ) {
      actions.push({
        icon: 'check-outline',
        onPress: finish(() => {
          void markChaptersUnreadAndResetProgress(selectedIds);
        }),
      });
    }

    if (selectedChapters.length === 1) {
      const selectedChapter = selectedChapters[0];
      actions.push({
        icon: selectedChapter.unread ? 'playlist-check' : 'playlist-remove',
        onPress: finish(() => {
          if (selectedChapter.unread) {
            markPreviouschaptersRead(selectedChapter.id);
          } else {
            markPreviousChaptersUnread(selectedChapter.id);
          }
        }),
      });
    }

    return actions;
  }, [
    bookmarkChapters,
    clearSelection,
    deleteChapters,
    downloadChapters,
    markChaptersRead,
    markChaptersUnreadAndResetProgress,
    markPreviousChaptersUnread,
    markPreviouschaptersRead,
    novel,
    selectedIds,
    selectedChapters,
  ]);

  return {
    deleteDownloadedChapters,
    downloadAvailableChapters,
    downloadChapters,
    selectionActions,
    shareNovel,
  };
};
