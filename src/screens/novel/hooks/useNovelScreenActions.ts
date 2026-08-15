import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import isNumber from 'lodash-es/isNumber';

import {
  getAllUndownloadedAndUnreadChapters,
  getAllUndownloadedChapters,
  getChaptersByIds,
} from '@database/queries/ChapterQueries';
import { ChapterInfo, NovelInfo } from '@database/types';
import { useDownload } from '@hooks/persisted';
import { resolveUrl } from '@services/plugin/fetch';
import { MaterialDesignIconName } from '@type/icon';

import { useNovelActions } from '../NovelContext';

type SelectionAction = {
  icon: MaterialDesignIconName;
  onPress: () => void;
};

interface UseNovelScreenActionsOptions {
  chapters: ChapterInfo[];
  clearSelection: () => void;
  novel?: NovelInfo;
  selectedIds: number[];
  selectedChapters: ChapterInfo[];
}

export const useNovelScreenActions = ({
  chapters,
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
    deleteChapters(
      chapters
        .filter(chapter => chapter.isDownloaded)
        .map(chapter => chapter.id),
    );
  }, [chapters, deleteChapters]);

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
