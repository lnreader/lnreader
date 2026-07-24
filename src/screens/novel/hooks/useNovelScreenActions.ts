import { useCallback, useMemo } from 'react';
import { Share } from 'react-native';
import { isNumber } from 'lodash-es';

import {
  getAllUndownloadedAndUnreadChapters,
  getAllUndownloadedChapters,
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
  selectedChapters: ChapterInfo[];
}

export const useNovelScreenActions = ({
  chapters,
  clearSelection,
  novel,
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
    deleteChapters(chapters.filter(chapter => chapter.isDownloaded));
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

    if (
      !novel?.isLocal &&
      selectedChapters.some(chapter => !chapter.isDownloaded)
    ) {
      actions.push({
        icon: 'download-outline',
        onPress: finish(() => {
          if (novel) {
            downloadChapters(
              novel,
              selectedChapters.filter(chapter => !chapter.isDownloaded),
            );
          }
        }),
      });
    }

    if (
      !novel?.isLocal &&
      selectedChapters.some(chapter => chapter.isDownloaded)
    ) {
      actions.push({
        icon: 'trash-can-outline',
        onPress: finish(() =>
          deleteChapters(
            selectedChapters.filter(chapter => chapter.isDownloaded),
          ),
        ),
      });
    }

    actions.push({
      icon: 'bookmark-outline',
      onPress: finish(() => bookmarkChapters(selectedChapters)),
    });

    if (selectedChapters.some(chapter => chapter.unread)) {
      actions.push({
        icon: 'check',
        onPress: finish(() => markChaptersRead(selectedChapters)),
      });
    }

    if (selectedChapters.some(chapter => !chapter.unread)) {
      actions.push({
        icon: 'check-outline',
        onPress: finish(() => {
          void markChaptersUnreadAndResetProgress(selectedChapters);
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
