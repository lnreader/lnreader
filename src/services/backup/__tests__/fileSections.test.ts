import { getSelectedBackupFileSections } from '../fileSections';
import { ZipBackupName } from '../types';

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  PLUGIN_STORAGE: '/storage/Plugins',
}));
describe('selected backup file sections', () => {
  const options = {
    library: true,
    settings: true,
    plugins: true,
    downloadedFiles: true,
  };

  it('keeps novel files in the legacy v2 section only', () => {
    expect(getSelectedBackupFileSections(options)).toEqual([
      {
        archiveName: ZipBackupName.PLUGINS,
        storagePath: '/storage/Plugins',
      },
    ]);
    expect(getSelectedBackupFileSections(options, 2)).toEqual([
      {
        archiveName: ZipBackupName.PLUGINS,
        storagePath: '/storage/Plugins',
      },
      {
        archiveName: ZipBackupName.NOVEL_FILES,
        storagePath: '/storage/Novels',
      },
    ]);
  });
});
