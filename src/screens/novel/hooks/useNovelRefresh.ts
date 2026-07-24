import { useCallback, useState } from 'react';
import { NovelInfo } from '@database/types';
import { BackgroundTaskEnqueuer } from '@services/backgroundTasks';
import { updateNovel } from '@services/updates/LibraryUpdateQueries';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';

interface UseNovelRefreshOptions {
  novel: NovelInfo | undefined;
  downloadNewChapters: boolean;
  refreshNovelMetadata: boolean;
  enqueue: BackgroundTaskEnqueuer;
  reloadNovel: () => Promise<void>;
}

export const useNovelRefresh = ({
  novel,
  downloadNewChapters,
  refreshNovelMetadata,
  enqueue,
  reloadNovel,
}: UseNovelRefreshOptions) => {
  const [updating, setUpdating] = useState(false);

  const refresh = useCallback(async () => {
    if (!novel || updating) {
      return;
    }

    setUpdating(true);
    try {
      await updateNovel(novel.pluginId, novel.path, novel.id, {
        downloadNewChapters,
        refreshNovelMetadata,
        enqueue,
      });
      await reloadNovel();
      showToast(getString('novelScreen.updatedToast', { name: novel.name }));
    } catch (error) {
      showToast(
        `Failed updating: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    } finally {
      setUpdating(false);
    }
  }, [
    downloadNewChapters,
    enqueue,
    novel,
    refreshNovelMetadata,
    reloadNovel,
    updating,
  ]);

  return { updating, refresh };
};
