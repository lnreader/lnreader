import { getString } from '@i18n/translations';
import NativeFile from '@modules/native-file';
import {
  LOCAL_PLUGIN_ID,
  reloadInstalledPlugins,
} from '@plugins/pluginManager';
import { PLUGIN_STORAGE } from '@utils/Storages';
import type { ResolvedBackupManifest } from './types';

export type RestoreResult = {
  novelCount: number;
  failedNovelCount: number;
  categoryCount: number;
  failedCategoryCount: number;
  settingsRestored: boolean;
  failedSectionCount: number;
  pluginIds: string[];
  manifest: ResolvedBackupManifest;
};

export const getMissingRestorePluginIds = async (pluginIds: string[]) => {
  const uniquePluginIds = [...new Set(pluginIds)].filter(
    pluginId => pluginId !== LOCAL_PLUGIN_ID,
  );
  const pluginAvailability = await Promise.all(
    uniquePluginIds.map(async pluginId => ({
      pluginId,
      exists: await NativeFile.exists(`${PLUGIN_STORAGE}/${pluginId}/index.js`),
    })),
  );

  return pluginAvailability
    .filter(plugin => !plugin.exists)
    .map(plugin => plugin.pluginId);
};

export const finalizeRestoredPlugins = async (result: RestoreResult) => {
  const failedPluginIds = result.manifest.sections.plugins
    ? await reloadInstalledPlugins()
    : [];

  return [
    ...new Set([
      ...(await getMissingRestorePluginIds(result.pluginIds)),
      ...failedPluginIds,
    ]),
  ];
};

export const getRestoreCompletionText = (
  result: RestoreResult,
  missingPluginIds: string[],
) => {
  const warnings: string[] = [];

  if (result.failedNovelCount > 0) {
    warnings.push(
      getString('backupScreen.novelsRestoreFailedSummary', {
        count: result.failedNovelCount,
      }),
    );
  }
  if (result.failedCategoryCount > 0) {
    warnings.push(
      getString('backupScreen.categoriesRestoreFailedSummary', {
        count: result.failedCategoryCount,
      }),
    );
  }
  if (!result.settingsRestored) {
    warnings.push(getString('backupScreen.settingsRestoreFailedSummary'));
  }
  if (result.failedSectionCount > 0) {
    warnings.push(
      getString('backupScreen.sectionsRestoreFailedSummary', {
        count: result.failedSectionCount,
      }),
    );
  }
  if (missingPluginIds.length > 0) {
    warnings.push(
      getString('backupScreen.missingPluginsAfterRestore', {
        plugins: missingPluginIds.join(', '),
      }),
    );
  }

  if (warnings.length === 0) {
    if (!result.manifest.sections.library) {
      return getString('backupScreen.backupRestored');
    }
    return getString('backupScreen.backupRestoredSummary', {
      count: result.novelCount,
    });
  }

  if (!result.manifest.sections.library) {
    return getString('backupScreen.backupRestoredSelectedWithWarnings', {
      warnings: warnings.join('; '),
    });
  }

  return getString('backupScreen.backupRestoredWithWarnings', {
    count: result.novelCount,
    warnings: warnings.join('; '),
  });
};
