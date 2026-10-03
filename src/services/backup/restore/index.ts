import { clearRestoreChapterMappings } from '@database/queries/NovelRestoreQueries';
import { _restoreCategory } from '@database/queries/CategoryQueries';
import type { BackupCategory } from '@database/types';
import type { RestoreProgressReporter } from './progress';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { INSTALLED_PLUGINS_KEY } from '@plugins/pluginManager';
import type { PluginItem } from '@plugins/types';
import { DEFAULT_BACKUP_OPTIONS, resolveBackupOptions } from '../options';
import {
  BackupEntryName,
  type BackupManifest,
  type ResolvedBackupManifest,
} from '../types';
import { restoreNovels } from './novels';
import type { RestoreResult } from './result';

const parsePluginList = (value: unknown): PluginItem[] => {
  const parsed: unknown = typeof value === 'string' ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) {
    throw new Error('Invalid installed plugin registry');
  }
  return parsed as PluginItem[];
};

const restoreMMKVData = (data: Record<string, unknown>) => {
  for (const key in data) {
    const value = data[key];
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean'
    ) {
      throw new Error('Invalid backup setting');
    }
    MMKVStorage.set(key, value);
  }
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
    if (
      (data.formatVersion === 2 || data.formatVersion === 3) &&
      data.sections
    ) {
      const novelDataFormat =
        data.novelDataFormat === 1 || data.novelDataFormat === 2
          ? data.novelDataFormat
          : undefined;
      const novelCount =
        typeof data.novelCount === 'number' &&
        Number.isSafeInteger(data.novelCount) &&
        data.novelCount >= 0
          ? data.novelCount
          : undefined;
      return {
        appVersion: data.appVersion ?? data.version ?? '',
        formatVersion: data.formatVersion,
        ...(novelDataFormat === undefined ? {} : { novelDataFormat }),
        ...((data.formatVersion === 3 || novelDataFormat === 2) &&
        novelCount !== undefined
          ? { novelCount }
          : {}),
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

const createRestoreRunId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type RestoreBenchmarkLogger = (message: string) => void;

const restoreDataInternal = async (
  cacheDirPath: string,
  progressReporter: RestoreProgressReporter | undefined,
  benchmarkLog: RestoreBenchmarkLogger | undefined,
  restoreRunId: string,
): Promise<RestoreResult> => {
  progressReporter?.(
    'manifest',
    0,
    getString('backupScreen.restoringData'),
    true,
  );
  const manifest = await getBackupManifest(cacheDirPath);
  benchmarkLog?.('restoreData:manifest:loaded');
  progressReporter?.(
    'manifest',
    1,
    getString('backupScreen.restoringData'),
    true,
  );
  const novelSummary = manifest.sections.library
    ? await restoreNovels(
        cacheDirPath,
        manifest,
        restoreRunId,
        progressReporter,
        benchmarkLog,
      )
    : {
        novelCount: 0,
        failedNovelCount: 0,
        failedSectionCount: 0,
        pluginIds: [],
        novelMappings: [],
        novelIdMap: new Map<number, number>(),
      };
  if (!manifest.sections.library) {
    progressReporter?.(
      'novels',
      1,
      getString('backupScreen.restoringNovels'),
      true,
    );
  }
  let failedSectionCount = novelSummary.failedSectionCount;
  const novelIdMap = novelSummary.novelIdMap;
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

  benchmarkLog?.('restoreData:categories:start');
  const categoriesProgressText = getString('backupScreen.restoringCategories');
  let categoryCount = 0;
  let failedCategoryCount = 0;
  if (!manifest.sections.library) {
    progressReporter?.('categories', 1, categoriesProgressText, true);
  } else {
    progressReporter?.('categories', 0, categoriesProgressText, true);
    const categoryFilePath = cacheDirPath + '/' + BackupEntryName.CATEGORY;
    let categories: BackupCategory[] | undefined;
    if (!(await NativeFile.exists(categoryFilePath))) {
      failedSectionCount++;
    } else {
      try {
        const fileContent = await NativeFile.readFile(categoryFilePath);
        const parsed: unknown = JSON.parse(fileContent);
        if (!Array.isArray(parsed)) {
          throw new Error('Invalid backup categories');
        }
        categories = parsed as BackupCategory[];
      } catch {
        failedSectionCount++;
      }
    }

    if (categories) {
      for (const [index, category] of categories.entries()) {
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
        progressReporter?.(
          'categories',
          (index + 1) / Math.max(1, categories.length),
          getString('backupScreen.restoringCategoriesProgress', {
            current: index + 1,
            total: categories.length,
          }),
          index + 1 === categories.length,
        );
      }
    }
    progressReporter?.('categories', 1, categoriesProgressText, true);
  }
  benchmarkLog?.(
    `restoreData:categories:done count=${categoryCount} failed=${failedCategoryCount}`,
  );

  benchmarkLog?.('restoreData:settings:start');
  const settingsProgressText = getString('backupScreen.restoringSettings');
  const settingsFilePath = cacheDirPath + '/' + BackupEntryName.SETTING;
  let settingsRestored = !manifest.sections.settings;

  if (!manifest.sections.settings) {
    progressReporter?.('settings', 1, settingsProgressText, true);
  } else {
    progressReporter?.('settings', 0, settingsProgressText, true);
    if (!(await NativeFile.exists(settingsFilePath))) {
      // Reported as a settings warning in the completion summary.
    } else {
      try {
        const fileContent = await NativeFile.readFile(settingsFilePath);
        const settingsData: Record<string, unknown> = JSON.parse(fileContent);
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
    progressReporter?.('settings', 1, settingsProgressText, true);
  }
  benchmarkLog?.(`restoreData:settings:done restored=${settingsRestored}`);

  benchmarkLog?.('restoreData:plugins:start');
  let restoredPlugins = pluginsFromSettings;
  const pluginsProgressText = getString('backupScreen.restoringPlugins');
  if (!manifest.sections.plugins) {
    progressReporter?.('plugins', 1, pluginsProgressText, true);
  } else {
    progressReporter?.('plugins', 0, pluginsProgressText, true);
    if (manifest.formatVersion === 2 || manifest.formatVersion === 3) {
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
    progressReporter?.('plugins', 1, pluginsProgressText, true);
  }
  benchmarkLog?.(`restoreData:plugins:done count=${restoredPlugins.length}`);
  benchmarkLog?.('restoreData:done');

  return {
    novelCount: novelSummary.novelCount,
    failedNovelCount: novelSummary.failedNovelCount,
    categoryCount,
    failedCategoryCount,
    settingsRestored,
    failedSectionCount,
    pluginIds: novelSummary.pluginIds,
    novelMappings: novelSummary.novelMappings,
    restoreRunId,
    manifest,
  };
};

export const clearRestoreChapterMappingsSafely = async (
  restoreRunId: string,
): Promise<void> => {
  try {
    await clearRestoreChapterMappings(restoreRunId);
  } catch {
    // Restore mappings are run-scoped and do not affect later restores.
  }
};

export const restoreData = async (
  cacheDirPath: string,
  progressReporter?: RestoreProgressReporter,
  benchmarkLog?: RestoreBenchmarkLogger,
): Promise<RestoreResult> => {
  const restoreRunId = createRestoreRunId();
  try {
    return await restoreDataInternal(
      cacheDirPath,
      progressReporter,
      benchmarkLog,
      restoreRunId,
    );
  } catch (error) {
    await clearRestoreChapterMappingsSafely(restoreRunId);
    throw error;
  }
};
