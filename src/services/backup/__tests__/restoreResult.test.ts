import NativeFile from '@modules/native-file';
import { reloadInstalledPlugins } from '@plugins/pluginManager';
import {
  finalizeRestoredPlugins,
  getMissingRestorePluginIds,
  getRestoreCompletionText,
  type RestoreResult,
} from '../restoreResult';

jest.mock('@i18n/translations', () => ({
  getString: (key: string, options?: Record<string, string | number>) => {
    const strings: Record<string, string> = {
      'backupScreen.settingsRestoreFailedSummary': 'settings failed',
      'backupScreen.missingPluginsAfterRestore': 'Missing plugins: %{plugins}',
    };
    const pluralStrings: Record<string, [string, string]> = {
      'backupScreen.backupRestoredSummary': [
        'Restored %{count} novel',
        'Restored %{count} novels',
      ],
      'backupScreen.backupRestoredWithWarnings': [
        'Restored %{count} novel with warnings: %{warnings}',
        'Restored %{count} novels with warnings: %{warnings}',
      ],
      'backupScreen.novelsRestoreFailedSummary': [
        '%{count} novel failed',
        '%{count} novels failed',
      ],
      'backupScreen.categoriesRestoreFailedSummary': [
        '%{count} category failed',
        '%{count} categories failed',
      ],
      'backupScreen.sectionsRestoreFailedSummary': [
        '%{count} backup section failed',
        '%{count} backup sections failed',
      ],
    };
    const pluralString = pluralStrings[key];
    const template = pluralString
      ? pluralString[options?.count === 1 ? 0 : 1]
      : strings[key] ?? key;

    return Object.entries(options ?? {}).reduce(
      (text, [name, value]) => text.replace(`%{${name}}`, String(value)),
      template,
    );
  },
}));

jest.mock('@plugins/pluginManager', () => ({
  LOCAL_PLUGIN_ID: 'local',
  reloadInstalledPlugins: jest.fn(),
}));

jest.mock('@utils/Storages', () => ({
  PLUGIN_STORAGE: '/storage/Plugins',
}));

const successfulResult: RestoreResult = {
  novelCount: 4,
  failedNovelCount: 0,
  categoryCount: 2,
  failedCategoryCount: 0,
  settingsRestored: true,
  failedSectionCount: 0,
  pluginIds: ['installed'],
  manifest: {
    appVersion: '2.1.0',
    formatVersion: 2,
    sections: {
      library: true,
      settings: true,
      plugins: true,
      downloadedFiles: true,
    },
  },
};

describe('restore result notifications', () => {
  beforeEach(() => {
    jest.mocked(reloadInstalledPlugins).mockReset();
  });

  it('uses a concise success message when the restore has no warnings', () => {
    expect(getRestoreCompletionText(successfulResult, [])).toBe(
      'Restored 4 novels',
    );
  });

  it('aggregates restore failures and missing plugin identifiers', () => {
    expect(
      getRestoreCompletionText(
        {
          ...successfulResult,
          failedNovelCount: 2,
          failedCategoryCount: 1,
          settingsRestored: false,
          failedSectionCount: 1,
        },
        ['source.one', 'source.two'],
      ),
    ).toBe(
      'Restored 4 novels with warnings: 2 novels failed; 1 category failed; settings failed; 1 backup section failed; Missing plugins: source.one, source.two',
    );
  });

  it('checks each referenced plugin once and ignores local novels', async () => {
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path.includes('installed'));

    await expect(
      getMissingRestorePluginIds(['local', 'installed', 'missing', 'missing']),
    ).resolves.toEqual(['missing']);
    expect(NativeFile.exists).toHaveBeenCalledTimes(2);
  });

  it('reloads restored plugin bundles and reports bundles that fail to load', async () => {
    jest.mocked(reloadInstalledPlugins).mockResolvedValueOnce(['invalid']);
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path => path.includes('installed'));

    await expect(
      finalizeRestoredPlugins({
        ...successfulResult,
        pluginIds: ['installed', 'missing'],
      }),
    ).resolves.toEqual(['missing', 'invalid']);
  });

  it('does not reload plugins when that section was omitted', async () => {
    await finalizeRestoredPlugins({
      ...successfulResult,
      pluginIds: [],
      manifest: {
        ...successfulResult.manifest,
        sections: {
          ...successfulResult.manifest.sections,
          plugins: false,
        },
      },
    });

    expect(reloadInstalledPlugins).not.toHaveBeenCalled();
  });

  it('does not describe an intentionally omitted library as zero novels', () => {
    expect(
      getRestoreCompletionText(
        {
          ...successfulResult,
          novelCount: 0,
          manifest: {
            ...successfulResult.manifest,
            sections: {
              ...successfulResult.manifest.sections,
              library: false,
              downloadedFiles: false,
            },
          },
        },
        [],
      ),
    ).toBe('backupScreen.backupRestored');
  });
});
