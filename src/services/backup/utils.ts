import { SELF_HOST_BACKUP } from '@hooks/persisted/useSelfHost';
import { OLD_TRACKED_NOVEL_PREFIX } from '@hooks/persisted/migrations/trackerMigration';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { version } from '../../../package.json';
import {
  _restoreNovelsAndChapters,
  getAllNovels,
  type RestoreNovelResult,
} from '@database/queries/NovelQueries';
import { getAllNovelChaptersForBackup } from '@database/queries/ChapterQueries';
import {
  _restoreCategory,
  getAllNovelCategories,
  getCategoriesFromDb,
} from '@database/queries/CategoryQueries';
import {
  BackupCategory,
  BackupNovel,
  type RestoredNovelMapping,
} from '@database/types';
import {
  BackupEntryName,
  type BackupManifest,
  type ResolvedBackupManifest,
} from './types';
import { NOVEL_STORAGE, ROOT_STORAGE } from '@utils/Storages';
import { BACKGROUND_TASKS_STORE_KEY } from '@services/backgroundTasks/constants';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import type { RestoreResult } from './restoreResult';
import type { BackupResult } from './backupResult';
import {
  DEFAULT_BACKUP_OPTIONS,
  resolveBackupOptions,
  type BackupOptions,
} from './options';
import { INSTALLED_PLUGINS_KEY } from '@plugins/pluginManager';
import type { PluginItem } from '@plugins/types';

const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

// Restored novels are written in groups so each transaction commit (and the
// live queries it wakes) covers many novels instead of one.
const RESTORE_BATCH_MAX_NOVELS = 200;
const RESTORE_BATCH_MAX_CHAPTERS = 20000;
// Cover copies run on native threads, so a few can overlap.
const RESTORE_COVER_CONCURRENCY = 8;
// Novel files are read and parsed ahead of the database writes, which spend
// most of their time waiting on SQLite. The bounds cap what is held in memory.
const RESTORE_READ_CONCURRENCY = 4;
const RESTORE_READ_AHEAD_MAX_NOVELS = RESTORE_BATCH_MAX_NOVELS;
const RESTORE_READ_AHEAD_MAX_CHAPTERS = RESTORE_BATCH_MAX_CHAPTERS;

type PendingRestoreNovel = {
  backupNovel: BackupNovel;
  hasStoredCover: boolean;
};

// `parsed` tells whether the file got far enough to name its plugin.
type LoadedRestoreNovel = {
  parsed: boolean;
  pluginId?: string;
  pending?: PendingRestoreNovel;
};

/**
 * Loads `items` ahead of the consumer and hands them out in their original
 * order. `load` must not reject.
 */
const createReadAhead = <T, R>(
  items: T[],
  load: (item: T) => Promise<R>,
  weigh: (result: R) => number,
) => {
  const results: (Promise<R> | undefined)[] = [];
  let started = 0;
  let consumed = 0;
  let inFlight = 0;
  let bufferedWeight = 0;
  let stopped = false;

  const start = () => {
    inFlight++;
    const index = started++;
    results[index] = load(items[index]).then(result => {
      inFlight--;
      bufferedWeight += weigh(result);
      pump();
      return result;
    });
  };
  const pump = () => {
    while (
      !stopped &&
      started < items.length &&
      inFlight < RESTORE_READ_CONCURRENCY &&
      started - consumed < RESTORE_READ_AHEAD_MAX_NOVELS &&
      bufferedWeight < RESTORE_READ_AHEAD_MAX_CHAPTERS
    ) {
      start();
    }
  };

  return {
    next: async (): Promise<R> => {
      pump();
      if (started === consumed) {
        start();
      }
      const result = await results[consumed]!;
      results[consumed++] = undefined;
      bufferedWeight -= weigh(result);
      pump();
      return result;
    },
    stop: () => {
      stopped = true;
    },
  };
};

const stripUriSuffix = (uri: string) => uri.split(/[?#]/, 1)[0];

const parentDirectory = (path: string) =>
  path.slice(0, Math.max(0, path.lastIndexOf('/')));

const parsePluginList = (value: unknown): PluginItem[] => {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid installed plugin registry');
  }
  return parsed as PluginItem[];
};

export const CACHE_DIR_PATH =
  NativeFile.ExternalCachesDirectoryPath + '/BackupData';

export const clearBackupCache = async (cacheDirPath = CACHE_DIR_PATH) => {
  if (await NativeFile.exists(cacheDirPath)) {
    await NativeFile.unlink(cacheDirPath);
  }
};

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
  const data = {} as any;
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

const restoreMMKVData = (data: any) => {
  for (const key in data) {
    MMKVStorage.set(key, data[key]);
  }
};

export const prepareBackupData = async (
  cacheDirPath: string,
  requestedOptions?: BackupOptions,
): Promise<BackupResult> => {
  const options = resolveBackupOptions(requestedOptions);
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;
  const coversDirPath = cacheDirPath + '/' + BackupEntryName.COVERS;
  let failedNovelCount = 0;
  let failedSectionCount = 0;

  await clearBackupCache(cacheDirPath);
  await NativeFile.mkdir(cacheDirPath);

  // version
  const manifest: BackupManifest = {
    appVersion: version,
    formatVersion: 2,
    sections: options,
  };
  await NativeFile.writeFile(
    cacheDirPath + '/' + BackupEntryName.VERSION,
    JSON.stringify(manifest),
  );

  // novels
  if (options.library) {
    await NativeFile.mkdir(novelDirPath);
    await NativeFile.mkdir(coversDirPath);
    await getAllNovels().then(async novels => {
      for (const novel of novels) {
        try {
          const chapters = await getAllNovelChaptersForBackup(novel.id);
          const backedUpChapters = options.downloadedFiles
            ? chapters
            : chapters.map(chapter => ({
                ...chapter,
                isDownloaded: false,
              }));
          let cover = novel.cover;
          if (cover?.startsWith(APP_STORAGE_URI)) {
            try {
              await NativeFile.copyFile(
                stripUriSuffix(cover),
                coversDirPath + '/' + novel.id,
              );
              cover = cover.replace(APP_STORAGE_URI, '');
            } catch {
              cover = options.downloadedFiles
                ? cover.replace(APP_STORAGE_URI, '')
                : null;
            }
          }
          await NativeFile.writeFile(
            novelDirPath + '/' + novel.id + '.json',
            JSON.stringify({
              chapters: backedUpChapters,
              ...novel,
              cover,
            }),
          );
        } catch {
          failedNovelCount++;
        }
      }
    });

    // categories
    try {
      const categories = await getCategoriesFromDb();
      const novelCategories = await getAllNovelCategories();
      await NativeFile.writeFile(
        cacheDirPath + '/' + BackupEntryName.CATEGORY,
        JSON.stringify(
          categories.map(category => {
            return {
              ...category,
              novelIds: novelCategories
                .filter(nc => nc.categoryId === category.id)
                .map(nc => nc.novelId),
            };
          }),
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

const getBackupManifest = async (
  cacheDirPath: string,
): Promise<ResolvedBackupManifest> => {
  try {
    const fileContent = await NativeFile.readFile(
      cacheDirPath + '/' + BackupEntryName.VERSION,
    );
    const data = JSON.parse(fileContent) as Partial<BackupManifest> & {
      version?: string;
    };
    if (data.formatVersion === 2 && data.sections) {
      return {
        appVersion: data.appVersion ?? data.version ?? '',
        formatVersion: 2,
        sections: resolveBackupOptions(data.sections),
      };
    }

    return {
      appVersion: data.version,
      formatVersion: 1,
      sections: DEFAULT_BACKUP_OPTIONS,
    };
  } catch {
    return {
      formatVersion: 1,
      sections: DEFAULT_BACKUP_OPTIONS,
    };
  }
};

const updateRestoreProgress = (
  setMeta: TaskProgressUpdater | undefined,
  progressText: string,
) => {
  setMeta?.(meta => ({
    ...meta,
    progressText,
  }));
};

export const restoreData = async (
  cacheDirPath: string,
  setMeta?: TaskProgressUpdater,
): Promise<RestoreResult> => {
  const manifest = await getBackupManifest(cacheDirPath);
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;
  const coversDirPath = cacheDirPath + '/' + BackupEntryName.COVERS;
  const pluginIds = new Set<string>();
  const novelIdMap = new Map<number, number>();
  const novelMappings: RestoredNovelMapping[] = [];
  const installedPluginsBeforeRestore = (() => {
    try {
      return parsePluginList(
        MMKVStorage.getString(INSTALLED_PLUGINS_KEY) ?? '[]',
      );
    } catch {
      return [];
    }
  })();
  let pluginsFromSettings: PluginItem[] = [];

  // version
  // nothing to do

  // novels
  if (manifest.sections.library) {
    updateRestoreProgress(setMeta, getString('backupScreen.restoringNovels'));
  }
  let novelCount = 0;
  let failedCount = 0;
  let failedSectionCount = 0;

  if (!manifest.sections.library) {
    // Intentionally omitted from this backup.
  } else if (!(await NativeFile.exists(novelDirPath))) {
    failedSectionCount++;
  } else {
    try {
      const items = (await NativeFile.readDir(novelDirPath)).filter(
        item => !item.isDirectory,
      );
      // Chapter ids are only looked up when downloaded chapter files will be
      // moved to them afterwards.
      const withChapterMappings =
        manifest.formatVersion === 1 || manifest.sections.downloadedFiles;
      let pendingNovels: PendingRestoreNovel[] = [];
      let pendingChapterCount = 0;

      let coverCopies = Promise.resolve();

      const restorePendingNovels = async () => {
        const batch = pendingNovels;
        pendingNovels = [];
        pendingChapterCount = 0;
        let results: RestoreNovelResult[];
        try {
          results = await _restoreNovelsAndChapters(
            batch.map(({ backupNovel }) => backupNovel),
            { withChapterMappings },
          );
        } catch {
          failedCount += batch.length;
          return;
        }

        const restoredNovels: {
          backupNovel: BackupNovel;
          hasStoredCover: boolean;
          novelMapping: RestoredNovelMapping;
        }[] = [];
        for (const [index, pending] of batch.entries()) {
          const novelMapping = results[index].mapping;
          if (!novelMapping) {
            failedCount++;
            continue;
          }
          novelMappings.push(novelMapping);
          novelIdMap.set(pending.backupNovel.id, novelMapping.restoredNovelId);
          restoredNovels.push({ ...pending, novelMapping });
        }

        const restoreCover = async ({
          backupNovel,
          hasStoredCover,
          novelMapping,
        }: (typeof restoredNovels)[number]) => {
          try {
            if (hasStoredCover) {
              const coverBackupPath = coversDirPath + '/' + backupNovel.id;
              if (await NativeFile.exists(coverBackupPath)) {
                const coverPath = `${NOVEL_STORAGE}/${backupNovel.pluginId}/${novelMapping.restoredNovelId}/cover.png`;
                await NativeFile.mkdir(parentDirectory(coverPath));
                await NativeFile.copyFile(coverBackupPath, coverPath);
              }
            }
            novelCount++;
          } catch {
            failedCount++;
          }
        };
        // Backup novels that share a path and plugin restore into one novel
        // and one cover file. Only the last one, whose row won, copies its
        // cover, so no two concurrent copies write the same destination.
        const coverJobs = [
          ...new Map(
            restoredNovels.map(restored => [
              restored.novelMapping.restoredNovelId,
              restored,
            ]),
          ).values(),
        ];
        novelCount += restoredNovels.length - coverJobs.length;
        // Covers copy while the next batch is written. Each batch's copies
        // start after the previous batch's, so the concurrency limit holds
        // and a cover is never written by two batches at once.
        const previousCoverCopies = coverCopies;
        coverCopies = (async () => {
          await previousCoverCopies;
          for (
            let start = 0;
            start < coverJobs.length;
            start += RESTORE_COVER_CONCURRENCY
          ) {
            await Promise.all(
              coverJobs
                .slice(start, start + RESTORE_COVER_CONCURRENCY)
                .map(restoreCover),
            );
          }
        })();
      };

      let reportedCount = -1;
      const reportProgress = (completed: number) => {
        if (completed === reportedCount) {
          return;
        }
        reportedCount = completed;
        updateRestoreProgress(
          setMeta,
          getString('backupScreen.restoringNovelsProgress', {
            current: completed,
            total: items.length,
          }),
        );
      };

      if (items.length > 0) {
        reportProgress(0);
      }
      const loadNovel = async (item: {
        path: string;
      }): Promise<LoadedRestoreNovel> => {
        const loaded: LoadedRestoreNovel = { parsed: false };
        try {
          const fileContent = await NativeFile.readFile(item.path);
          const backupNovel = JSON.parse(fileContent) as BackupNovel;
          loaded.pluginId = backupNovel.pluginId;
          loaded.parsed = true;

          const hasStoredCover = Boolean(
            backupNovel.cover && !backupNovel.cover.startsWith('http'),
          );
          if (hasStoredCover) {
            backupNovel.cover = APP_STORAGE_URI + backupNovel.cover;
          }
          loaded.pending = { backupNovel, hasStoredCover };
        } catch {
          // Counted as a failed novel by the consumer.
        }
        return loaded;
      };
      const readAhead = createReadAhead(
        items,
        loadNovel,
        loaded => loaded.pending?.backupNovel.chapters?.length ?? 0,
      );
      try {
        for (let index = 0; index < items.length; index++) {
          const { parsed, pluginId, pending } = await readAhead.next();
          if (parsed) {
            pluginIds.add(pluginId as string);
          }
          if (pending) {
            pendingNovels.push(pending);
            pendingChapterCount += pending.backupNovel.chapters?.length ?? 0;
          } else {
            failedCount++;
          }
          if (
            pendingNovels.length >= RESTORE_BATCH_MAX_NOVELS ||
            pendingChapterCount >= RESTORE_BATCH_MAX_CHAPTERS
          ) {
            await restorePendingNovels();
            reportProgress(index + 1);
          }
        }
        await restorePendingNovels();
      } finally {
        readAhead.stop();
        await coverCopies;
      }
      if (items.length > 0) {
        reportProgress(items.length);
      }
    } catch {
      failedSectionCount++;
    }
  }

  // categories
  if (manifest.sections.library) {
    updateRestoreProgress(
      setMeta,
      getString('backupScreen.restoringCategories'),
    );
  }
  const categoryFilePath = cacheDirPath + '/' + BackupEntryName.CATEGORY;
  let categoryCount = 0;
  let failedCategoryCount = 0;

  if (!manifest.sections.library) {
    // Intentionally omitted from this backup.
  } else if (!(await NativeFile.exists(categoryFilePath))) {
    failedSectionCount++;
  } else {
    try {
      const fileContent = await NativeFile.readFile(categoryFilePath);
      const categories: BackupCategory[] = JSON.parse(fileContent);

      for (const [index, category] of categories.entries()) {
        updateRestoreProgress(
          setMeta,
          getString('backupScreen.restoringCategoriesProgress', {
            current: index + 1,
            total: categories.length,
          }),
        );
        try {
          await _restoreCategory(
            {
              ...category,
              novelIds: category.novelIds.filter(novelId =>
                novelIdMap.has(novelId),
              ),
            },
            novelIdMap,
          );
          categoryCount++;
        } catch {
          failedCategoryCount++;
        }
      }
    } catch {
      failedSectionCount++;
    }
  }

  // settings
  if (manifest.sections.settings) {
    updateRestoreProgress(setMeta, getString('backupScreen.restoringSettings'));
  }
  const settingsFilePath = cacheDirPath + '/' + BackupEntryName.SETTING;
  let settingsRestored = !manifest.sections.settings;

  if (!manifest.sections.settings) {
    // Intentionally omitted from this backup.
  } else if (!(await NativeFile.exists(settingsFilePath))) {
    // Reported as a settings warning in the completion summary.
  } else {
    try {
      const fileContent = await NativeFile.readFile(settingsFilePath);
      const settingsData = JSON.parse(fileContent);
      if (INSTALLED_PLUGINS_KEY in settingsData) {
        pluginsFromSettings = parsePluginList(
          settingsData[INSTALLED_PLUGINS_KEY],
        );
        delete settingsData[INSTALLED_PLUGINS_KEY];
      }
      restoreMMKVData(settingsData);
      settingsRestored = true;
    } catch {
      // Included in the completion warning below.
    }
  }

  // installed plugin registry
  if (manifest.sections.plugins) {
    let restoredPlugins = pluginsFromSettings;
    if (manifest.formatVersion === 2) {
      const pluginMetadataPath =
        cacheDirPath + '/' + BackupEntryName.PLUGIN_METADATA;
      if (!(await NativeFile.exists(pluginMetadataPath))) {
        failedSectionCount++;
      } else {
        try {
          restoredPlugins = parsePluginList(
            await NativeFile.readFile(pluginMetadataPath),
          );
        } catch {
          failedSectionCount++;
        }
      }
    }
    const mergedPlugins = [
      ...new Map(
        [...installedPluginsBeforeRestore, ...restoredPlugins].map(plugin => [
          plugin.id,
          plugin,
        ]),
      ).values(),
    ];
    MMKVStorage.set(INSTALLED_PLUGINS_KEY, JSON.stringify(mergedPlugins));
  }

  return {
    novelCount,
    failedNovelCount: failedCount,
    categoryCount,
    failedCategoryCount,
    settingsRestored,
    failedSectionCount,
    pluginIds: [...pluginIds],
    novelMappings,
    manifest,
  };
};
