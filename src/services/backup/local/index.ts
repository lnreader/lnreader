import { CACHE_DIR_PATH } from '../cache';
import { prepareBackupData } from '../create';
import { getBackupCompletionText } from '../backupResult';
import NativeZipArchive from '@modules/native-zip-archive';
import { BackupEntryName } from '../types';
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';
import { sleep } from '@utils/sleep';
import { NOVEL_STORAGE } from '@utils/Storages';
import { getSelectedBackupFileSections } from '../fileSections';
import { resolveBackupOptions, type BackupOptions } from '../options';

export const createBackup = async (
  {
    destinationUri,
    options: requestedOptions,
  }: { destinationUri: string; options?: BackupOptions },
  setMeta?: TaskProgressUpdater,
) => {
  try {
    const options = resolveBackupOptions(requestedOptions);
    setMeta?.(meta => ({
      ...meta,
      isRunning: true,
      progress: 0 / 4,
      progressText: getString('backupScreen.preparingData'),
    }));

    const backupResult = await prepareBackupData(CACHE_DIR_PATH, options, 3);

    setMeta?.(meta => ({
      ...meta,
      progress: 1 / 4,
      progressText: getString('backupScreen.preparingSelectedFiles'),
    }));

    await sleep(200);

    for (const section of getSelectedBackupFileSections(options)) {
      await NativeZipArchive.zip(
        section.storagePath,
        `${CACHE_DIR_PATH}/${section.archiveName}`,
      );
    }

    setMeta?.(meta => ({
      ...meta,
      progress: 2 / 4,
      progressText: getString('backupScreen.uploadingData'),
    }));

    await sleep(200);

    await NativeZipArchive.zipDirectories(
      [
        { path: CACHE_DIR_PATH, prefix: '' },
        ...(options.downloadedFiles
          ? [{ path: NOVEL_STORAGE, prefix: BackupEntryName.NOVEL_FILES }]
          : []),
      ],
      CACHE_DIR_PATH + '.zip',
    );

    setMeta?.(meta => ({
      ...meta,
      progress: 3 / 4,
      progressText: getString('backupScreen.savingBackup'),
    }));

    await NativeFile.copyFile(CACHE_DIR_PATH + '.zip', destinationUri);

    const completionText = getBackupCompletionText(backupResult);
    setMeta?.(meta => ({
      ...meta,
      progress: 4 / 4,
      isRunning: false,
      progressText: completionText,
      completionText,
    }));
  } catch (error) {
    setMeta?.(meta => ({
      ...meta,
      isRunning: false,
    }));
    throw error;
  }
};
