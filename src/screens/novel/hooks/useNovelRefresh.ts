import { useCallback, useState } from 'react';
import { NovelInfo } from '@database/types';
import { BackgroundTaskEnqueuer } from '@services/backgroundTasks';
import { updateNovel } from '@services/updates/LibraryUpdateQueries';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';
import { useLibraryContext } from '@components/Context/LibraryContext';

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
  const { refetchLibrary } = useLibraryContext();

  const refresh = useCallback(async () => {
    if (!novel || updating) {
      return;
    }
    const { pluginId, path: novelPath, id, inLibrary, name: novelName } = novel;

    setUpdating(true);
    try {
      await updateNovel(pluginId, novelPath, id, {
        downloadNewChapters,
        refreshNovelMetadata,
        enqueue,
      });
      await Promise.all([
        reloadNovel(),
        inLibrary ? refetchLibrary() : Promise.resolve(),
      ]);
      showToast(getString('novelScreen.updatedToast', { name: novelName }));
    } catch (error) {
      showToast(
        `Failed updating: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    setUpdating(false);
  }, [
    downloadNewChapters,
    enqueue,
    novel,
    refetchLibrary,
    refreshNovelMetadata,
    reloadNovel,
    updating,
  ]);

  return { updating, refresh };
};
