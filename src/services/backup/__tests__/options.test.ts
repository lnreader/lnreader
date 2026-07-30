import {
  areAllBackupOptionsSelected,
  DEFAULT_BACKUP_OPTIONS,
  hasSelectedBackupOption,
  resolveBackupOptions,
} from '../options';
import { getSelectedBackupFileSections } from '../fileSections';
import { ZipBackupName } from '../types';

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
}));

describe('backup options', () => {
  it('preserves the existing full-backup behavior by default', () => {
    expect(resolveBackupOptions()).toEqual(DEFAULT_BACKUP_OPTIONS);
    expect(areAllBackupOptionsSelected(resolveBackupOptions())).toBe(true);
  });

  it('prevents downloaded files from being selected without library data', () => {
    expect(
      resolveBackupOptions({
        library: false,
        settings: true,
        plugins: false,
        downloadedFiles: true,
      }),
    ).toEqual({
      library: false,
      settings: true,
      plugins: false,
      downloadedFiles: false,
    });
  });

  it('requires at least one selected section', () => {
    expect(
      hasSelectedBackupOption({
        library: false,
        settings: false,
        plugins: false,
        downloadedFiles: false,
      }),
    ).toBe(false);
  });

  it('maps selected file sections to independent archives', () => {
    expect(
      getSelectedBackupFileSections({
        library: true,
        settings: true,
        plugins: true,
        downloadedFiles: false,
      }),
    ).toEqual([
      {
        archiveName: ZipBackupName.PLUGINS,
        storagePath: '/storage/Plugins',
      },
    ]);
  });
});
