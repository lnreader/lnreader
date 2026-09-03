import { mergeWith } from 'lodash-es';
import { SELF_HOST_BACKUP } from '@hooks/persisted/useSelfHost';
import { OLD_TRACKED_NOVEL_PREFIX } from '@hooks/persisted/migrations/trackerMigration';
import { LAST_UPDATE_TIME } from '@hooks/persisted/useUpdates';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { version } from '../../../package.json';
import {
  _restoreNovelAndChapters,
  getAllNovels,
} from '@database/queries/NovelQueries';
import { getAllNovelChaptersForBackup } from '@database/queries/ChapterQueries';
import {
  _restoreCategory,
  getAllNovelCategories,
  getCategoriesFromDb,
} from '@database/queries/CategoryQueries';
import type { RestoreMode } from '@database/queries/_restoreMergeUtils';
import { BackupCategory, BackupNovel } from '@database/types';
import {
  BackupEntryName,
  type BackupManifest,
  type ResolvedBackupManifest,
} from './types';
import { ROOT_STORAGE } from '@utils/Storages';
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

const APP_STORAGE_URI = 'file://' + ROOT_STORAGE;

const stripUriSuffix = (uri: string) => uri.split(/[?#]/, 1)[0];

const parentDirectory = (path: string) =>
  path.slice(0, Math.max(0, path.lastIndexOf('/')));

export const CACHE_DIR_PATH =
  NativeFile.ExternalCachesDirectoryPath + '/BackupData';

export const clearBackupCache = async (cacheDirPath = CACHE_DIR_PATH) => {
  if (await NativeFile.exists(cacheDirPath)) {
    await NativeFile.unlink(cacheDirPath);
  }
};

const backupMMKVData = (options: BackupOptions) => {
  const excludeKeys = [
    BACKGROUND_TASKS_STORE_KEY,
    OLD_TRACKED_NOVEL_PREFIX,
    SELF_HOST_BACKUP,
    LAST_UPDATE_TIME,
    ...(options.plugins ? [] : [INSTALLED_PLUGINS_KEY]),
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

// Backup wins for primitives; arrays are replaced wholesale (element-wise
// merge of arrays usually surprises users — settings list values are
// normally meant to be replaced as a unit).
const settingsMergeCustomizer = (
  _existingValue: unknown,
  backupValue: unknown,
) => {
  if (Array.isArray(backupValue)) {
    return backupValue;
  }
  return undefined;
};

const deepMergeJsonString = (existing: string, backup: string): string => {
  let existingParsed: unknown;
  let backupParsed: unknown;
  try {
    existingParsed = JSON.parse(existing);
  } catch {
    return backup;
  }
  try {
    backupParsed = JSON.parse(backup);
  } catch {
    return backup;
  }

  if (
    typeof existingParsed !== 'object' ||
    existingParsed === null ||
    typeof backupParsed !== 'object' ||
    backupParsed === null ||
    Array.isArray(existingParsed) ||
    Array.isArray(backupParsed)
  ) {
    // Not both plain objects — backup wins as a whole (per merge policy).
    return backup;
  }

  const merged = mergeWith(
    {},
    existingParsed,
    backupParsed,
    settingsMergeCustomizer,
  );
  return JSON.stringify(merged);
};

const restoreMMKVData = (data: any, mode: RestoreMode = 'overwrite') => {
  for (const key in data) {
    const backupRaw = data[key];

    if (mode === 'overwrite') {
      MMKVStorage.set(key, backupRaw);
      continue;
    }

    // merge: pull existing string, deep-merge JSON, fall back to backup.
    const existingStr = MMKVStorage.getString(key);
    if (
      existingStr === undefined ||
      existingStr === null ||
      existingStr === ''
    ) {
      MMKVStorage.set(key, backupRaw);
      continue;
    }
    if (typeof backupRaw !== 'string') {
      // boolean / non-string backup — restore wins per "뒤에 restore가 우선"
      MMKVStorage.set(key, backupRaw);
      continue;
    }
    MMKVStorage.set(key, deepMergeJsonString(existingStr, backupRaw));
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
        JSON.stringify(backupMMKVData(options)),
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
  mode: RestoreMode = 'overwrite',
): Promise<RestoreResult> => {
  const manifest = await getBackupManifest(cacheDirPath);
  const novelDirPath = cacheDirPath + '/' + BackupEntryName.NOVEL_AND_CHAPTERS;
  const coversDirPath = cacheDirPath + '/' + BackupEntryName.COVERS;
  const pluginIds = new Set<string>();
  // Maps backup novel.id -> live DB novel.id. In merge mode the live id may
  // differ from the backup id (auto-increment for new novels, existing id
  // for matched ones). Categories use this map to remap their novelIds.
  const novelIdMap = new Map<number, number>();

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
      for (const [index, item] of items.entries()) {
        updateRestoreProgress(
          setMeta,
          getString('backupScreen.restoringNovelsProgress', {
            current: index + 1,
            total: items.length,
          }),
        );
        try {
          const fileContent = await NativeFile.readFile(item.path);
          const backupNovel = JSON.parse(fileContent) as BackupNovel;
          pluginIds.add(backupNovel.pluginId);

          if (backupNovel.cover && !backupNovel.cover.startsWith('http')) {
            const coverBackupPath = coversDirPath + '/' + backupNovel.id;
            if (await NativeFile.exists(coverBackupPath)) {
              const coverPath =
                ROOT_STORAGE + stripUriSuffix(backupNovel.cover);
              await NativeFile.mkdir(parentDirectory(coverPath));
              await NativeFile.copyFile(coverBackupPath, coverPath);
            }
            backupNovel.cover = APP_STORAGE_URI + backupNovel.cover;
          }

          await _restoreNovelAndChapters(backupNovel, { mode, novelIdMap });
          novelCount++;
        } catch {
          failedCount++;
        }
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
          await _restoreCategory(category, { mode, novelIdMap });
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
      restoreMMKVData(settingsData, mode);
      settingsRestored = true;
    } catch {
      // Included in the completion warning below.
    }
  }

  // installed plugin registry
  if (manifest.formatVersion === 2 && manifest.sections.plugins) {
    const pluginMetadataPath =
      cacheDirPath + '/' + BackupEntryName.PLUGIN_METADATA;
    if (!(await NativeFile.exists(pluginMetadataPath))) {
      failedSectionCount++;
    } else {
      try {
        const installedPlugins = await NativeFile.readFile(pluginMetadataPath);
        JSON.parse(installedPlugins);
        MMKVStorage.set(INSTALLED_PLUGINS_KEY, installedPlugins);
      } catch {
        failedSectionCount++;
      }
    }
  }

  return {
    novelCount,
    failedNovelCount: failedCount,
    categoryCount,
    failedCategoryCount,
    settingsRestored,
    failedSectionCount,
    pluginIds: [...pluginIds],
    manifest,
  };
};
