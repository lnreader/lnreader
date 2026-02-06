import {
  getLibraryWithCategory,
  getLibraryNovelsFromDb,
} from '../../database/queries/LibraryQueries';

import { showToast } from '../../utils/showToast';
import { UpdateNovelOptions, updateNovel } from './LibraryUpdateQueries';
import { DBNovelInfo } from '@database/types';
import { sleep } from '@utils/sleep';
import { MMKVStorage, getMMKVObject } from '@utils/mmkv/mmkv';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import dayjs from 'dayjs';
import { APP_SETTINGS, AppSettings } from '@hooks/persisted/useSettings';
import { BackgroundTaskMetadata } from '@services/ServiceManager';

const updateLibrary = async (
  {
    categoryId,
  }: {
    categoryId?: number;
  },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
  }));

  const { downloadNewChapters, refreshNovelMetadata, onlyUpdateOngoingNovels } =
    getMMKVObject<AppSettings>(APP_SETTINGS) || {};
  const options: UpdateNovelOptions = {
    downloadNewChapters: downloadNewChapters || false,
    refreshNovelMetadata: refreshNovelMetadata || false,
  };

  let libraryNovels: DBNovelInfo[] = [];
  if (categoryId) {
    libraryNovels = await getLibraryWithCategory(
      categoryId,
      onlyUpdateOngoingNovels,
      true,
    );
  } else {
    libraryNovels = await getLibraryNovelsFromDb(
      '',
      onlyUpdateOngoingNovels ? "status = 'Ongoing'" : '',
      '',
      false,
      true,
    );
  }

  if (libraryNovels.length > 0) {
    MMKVStorage.set(LAST_UPDATE_TIME, dayjs().format('YYYY-MM-DD HH:mm:ss'));
    for (let i = 0; i < libraryNovels.length; i++) {
      setMeta(meta => ({
        ...meta,
        progressText: libraryNovels[i].name,
        progress: i / libraryNovels.length,
      }));

      try {
        await updateNovel(
          libraryNovels[i].pluginId,
          libraryNovels[i].path,
          libraryNovels[i].id,
          options,
        );
        await sleep(1000);
      } catch (error: any) {
        showToast(libraryNovels[i].name + ': ' + error.message);
        continue;
      }
    }
  } else {
    showToast("There's no novel to be updated");
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));
};

export { updateLibrary };
