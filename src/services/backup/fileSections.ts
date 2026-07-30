import { NOVEL_STORAGE, PLUGIN_STORAGE } from '@utils/Storages';
import type { BackupOptions } from './options';
import { ZipBackupName } from './types';

export type BackupFileSection = {
  archiveName: ZipBackupName;
  storagePath: string;
};

export const getSelectedBackupFileSections = (
  options: BackupOptions,
): BackupFileSection[] => {
  const sections: BackupFileSection[] = [];

  if (options.plugins) {
    sections.push({
      archiveName: ZipBackupName.PLUGINS,
      storagePath: PLUGIN_STORAGE,
    });
  }
  if (options.downloadedFiles) {
    sections.push({
      archiveName: ZipBackupName.NOVEL_FILES,
      storagePath: NOVEL_STORAGE,
    });
  }

  return sections;
};
