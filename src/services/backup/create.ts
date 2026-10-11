import { SELF_HOST_BACKUP } from '@hooks/persisted/useSelfHost';
import { OLD_TRACKED_NOVEL_PREFIX } from '@hooks/persisted/migrations/trackerMigration';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { version } from '../../../package.json';
import { getAllNovels } from '@database/queries/NovelQueries';
import { getAllNovelChaptersForBackup } from '@database/queries/ChapterQueries';
import {
  getAllNovelCategories,
  getCategoriesFromDb,
} from '@database/queries/CategoryQueries';
import type { BackupNovel } from '@database/types';
import { encodeNovelBatch, validateBackupNovel } from './novelPayload';
import { BackupEntryName, type BackupManifest } from './types';
import { BACKGROUND_TASKS_STORE_KEY } from '@services/backgroundTasks/constants';
import NativeFile from '@modules/native-file';
import type { BackupResult } from './backupResult';
import { resolveBackupOptions, type BackupOptions } from './options';
import { INSTALLED_PLUGINS_KEY } from '@plugins/pluginManager';
import { ROOT_STORAGE } from '@utils/Storages';
import { clearBackupCache } from './cache';

const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

const BACKUP_NOVEL_BATCH_SIZE = 100;

const BACKUP_FILE_CONCURRENCY = 8;

const backupMMKVData = () => {
  const excludeKeys = [
    BACKGROUND_TASKS_STORE_KEY,
    OLD_TRACKED_NOVEL_PREFIX,
    SELF_HOST_BACKUP,
    LAST_UPDATE_TIME,
    INSTALLED_PLUGINS_KEY,
  ];
  const keys = MMKVStorage.getAllKeys().filter(
    key => !excludeKeys.includes(key),
  );
  const data: Record<string, string | number | boolean> = {};
  for (const key of keys) {
    let value: number | string | boolean | undefined =
      MMKVStorage.getString(key);
    if (!value) {
      value = MMKVStorage.getBoolean(key);
    }
    if (key && value) {
      data[key] = value;
    }
  }
  return data;
};

export const prepareBackupData = async (
  cacheDirPath: string,
  requestedOptions?: BackupOptions,
  formatVersion: BackupManifest['formatVersion'] = 2,
): Promise<BackupResult> => {
  const options = resolveBackupOptions(requestedOptions);
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;
  const coversDirPath = cacheDirPath + '/' + BackupEntryName.COVERS;
  let failedNovelCount = 0;
  let failedSectionCount = 0;

  await clearBackupCache(cacheDirPath);
  await NativeFile.mkdir(cacheDirPath);

  const manifest: BackupManifest = {
    appVersion: version,
    formatVersion,
    novelDataFormat: 2,
    sections: options,
  };
  await NativeFile.writeFile(
    cacheDirPath + '/' + BackupEntryName.VERSION,
    JSON.stringify(manifest),
  );

  // novels
  if (options.library) {
    await NativeFile.mkdir(novelDirPath);
    if (!options.downloadedFiles) {
      await NativeFile.mkdir(coversDirPath);
    }
    let backedUpNovelCount = 0;
    const novels = await getAllNovels();
    for (
      let start = 0;
      start < novels.length;
      start += BACKUP_NOVEL_BATCH_SIZE
    ) {
      const novelBatch = novels.slice(start, start + BACKUP_NOVEL_BATCH_SIZE);
      let chapters;
      try {
        chapters = await getAllNovelChaptersForBackup(
          novelBatch.map(novel => novel.id),
        );
      } catch {
        failedNovelCount += novelBatch.length;
        continue;
      }

      const chaptersByNovel = new Map<number, BackupNovel['chapters']>();
      for (const chapter of chapters) {
        const novelChapters = chaptersByNovel.get(chapter.novelId);
        if (novelChapters) {
          novelChapters.push(chapter);
        } else {
          chaptersByNovel.set(chapter.novelId, [chapter]);
        }
      }

      const preparedNovels: BackupNovel[] = [];
      for (
        let fileStart = 0;
        fileStart < novelBatch.length;
        fileStart += BACKUP_FILE_CONCURRENCY
      ) {
        const fileBatch = novelBatch.slice(
          fileStart,
          fileStart + BACKUP_FILE_CONCURRENCY,
        );
        const prepared = await Promise.all(
          fileBatch.map(async (novel): Promise<BackupNovel | null> => {
            try {
              const novelChapters = chaptersByNovel.get(novel.id) ?? [];
              const backedUpChapters = options.downloadedFiles
                ? novelChapters
                : novelChapters.map(chapter => ({
                    ...chapter,
                    isDownloaded: false,
                  }));
              let cover = novel.cover;
              if (cover?.startsWith(APP_STORAGE_URI)) {
                if (options.downloadedFiles) {
                  cover = cover.replace(APP_STORAGE_URI, '');
                } else {
                  try {
                    await NativeFile.copyFile(
                      cover.split(/[?#]/, 1)[0],
                      coversDirPath + '/' + novel.id,
                    );
                    cover = cover.replace(APP_STORAGE_URI, '');
                  } catch {
                    cover = null;
                  }
                }
              }
              const preparedNovel = {
                ...novel,
                chapters: backedUpChapters,
                cover,
              };
              return validateBackupNovel(preparedNovel);
            } catch {
              failedNovelCount++;
              return null;
            }
          }),
        );
        preparedNovels.push(
          ...prepared.filter((novel): novel is BackupNovel => novel !== null),
        );
      }

      if (preparedNovels.length > 0) {
        const batchName = `batch-${String(
          Math.floor(start / BACKUP_NOVEL_BATCH_SIZE) + 1,
        ).padStart(6, '0')}.json`;
        const batchPath = novelDirPath + '/' + batchName;
        try {
          await NativeFile.writeFile(
            batchPath,
            JSON.stringify(encodeNovelBatch(preparedNovels)),
          );
          backedUpNovelCount += preparedNovels.length;
        } catch {
          failedNovelCount += preparedNovels.length;
          try {
            await NativeFile.unlink(batchPath);
          } catch {
            // Best effort cleanup prevents a failed write from restoring partial data.
          }
        }
      }
    }
    manifest.novelCount = backedUpNovelCount;
    await NativeFile.writeFile(
      cacheDirPath + '/' + BackupEntryName.VERSION,
      JSON.stringify(manifest),
    );

    // categories
    try {
      const categories = await getCategoriesFromDb();
      const novelCategories = await getAllNovelCategories();
      const novelIdsByCategory = new Map<number, number[]>();
      for (const novelCategory of novelCategories) {
        const novelIds = novelIdsByCategory.get(novelCategory.categoryId);
        if (novelIds) {
          novelIds.push(novelCategory.novelId);
        } else {
          novelIdsByCategory.set(novelCategory.categoryId, [
            novelCategory.novelId,
          ]);
        }
      }
      await NativeFile.writeFile(
        cacheDirPath + '/' + BackupEntryName.CATEGORY,
        JSON.stringify(
          categories.map(category => ({
            ...category,
            novelIds: novelIdsByCategory.get(category.id) ?? [],
          })),
        ),
      );
    } catch {
      failedSectionCount++;
    }
  }

  // settings
  if (options.settings) {
    try {
      await NativeFile.writeFile(
        cacheDirPath + '/' + BackupEntryName.SETTING,
        JSON.stringify(backupMMKVData()),
      );
    } catch {
      failedSectionCount++;
    }
  }

  // installed plugin registry
  if (options.plugins) {
    try {
      await NativeFile.writeFile(
        cacheDirPath + '/' + BackupEntryName.PLUGIN_METADATA,
        MMKVStorage.getString(INSTALLED_PLUGINS_KEY) ?? '[]',
      );
    } catch {
      failedSectionCount++;
    }
  }

  return {
    failedNovelCount,
    failedSectionCount,
  };
};
