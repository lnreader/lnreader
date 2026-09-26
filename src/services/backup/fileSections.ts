import { NOVEL_STORAGE, PLUGIN_STORAGE } from '@utils/Storages';
import type { BackupOptions } from './options';
import { ZipBackupName } from './types';
import NativeFile from '@modules/native-file';
import type { RestoredNovelMapping } from '@database/types';
import { getRestoreChapterMappings } from '@database/queries/NovelRestoreQueries';
export type BackupFileSection = {
  archiveName: ZipBackupName;
  storagePath: string;
};

export const getSelectedBackupFileSections = (
  options: BackupOptions,
  formatVersion: 2 | 3 = 3,
): BackupFileSection[] => {
  const sections: BackupFileSection[] = [];

  if (options.plugins) {
    sections.push({
      archiveName: ZipBackupName.PLUGINS,
      storagePath: PLUGIN_STORAGE,
    });
  }
  if (formatVersion === 2 && options.downloadedFiles) {
    sections.push({
      archiveName: ZipBackupName.NOVEL_FILES,
      storagePath: NOVEL_STORAGE,
    });
  }

  return sections;
};

export const getNovelFilesRestorePath = (cacheDirPath: string) =>
  `${cacheDirPath}/RestoredNovelFiles`;

export const getLegacyFilesRestorePath = (cacheDirPath: string) =>
  `${cacheDirPath}/RestoredLegacyFiles`;

const moveDirectoryContents = async (source: string, destination: string) => {
  if (!(await NativeFile.exists(source))) {
    return;
  }
  await NativeFile.mkdir(destination);
  for (const item of await NativeFile.readDir(source)) {
    const destinationPath = `${destination}/${item.name}`;
    if (item.isDirectory) {
      await moveDirectoryContents(item.path, destinationPath);
    } else {
      await NativeFile.moveFile(item.path, destinationPath);
    }
  }
};

const RESTORE_CHAPTER_LOOKUP_BATCH_SIZE = 100;

export const restoreNovelFiles = async (
  stagingPath: string,
  novelMappings: RestoredNovelMapping[],
  restoreRunId: string,
) => {
  for (const mapping of novelMappings) {
    const sourceNovelPath = `${stagingPath}/${mapping.pluginId}/${mapping.backupNovelId}`;
    if (!(await NativeFile.exists(sourceNovelPath))) {
      continue;
    }

    const destinationNovelPath = `${NOVEL_STORAGE}/${mapping.pluginId}/${mapping.restoredNovelId}`;
    await NativeFile.mkdir(destinationNovelPath);
    const items = await NativeFile.readDir(sourceNovelPath);
    for (const item of items) {
      if (!item.isDirectory) {
        await NativeFile.moveFile(
          item.path,
          `${destinationNovelPath}/${item.name}`,
        );
      }
    }

    const chapterItems = items.filter(item => item.isDirectory);
    for (
      let start = 0;
      start < chapterItems.length;
      start += RESTORE_CHAPTER_LOOKUP_BATCH_SIZE
    ) {
      const chapterBatch = chapterItems.slice(
        start,
        start + RESTORE_CHAPTER_LOOKUP_BATCH_SIZE,
      );
      const backupChapterIds = chapterBatch
        .map(item => Number(item.name))
        .filter(id => Number.isInteger(id) && id > 0);
      const chapterMappings = await getRestoreChapterMappings(
        restoreRunId,
        mapping.backupNovelId,
        backupChapterIds,
      );
      const restoredChapterIds = new Map(
        chapterMappings.map(chapter => [
          String(chapter.backupChapterId),
          chapter.restoredChapterId,
        ]),
      );
      for (const item of chapterBatch) {
        const restoredChapterId = restoredChapterIds.get(item.name);
        if (restoredChapterId !== undefined) {
          await moveDirectoryContents(
            item.path,
            `${destinationNovelPath}/${restoredChapterId}`,
          );
        }
      }
    }
  }

  if (await NativeFile.exists(stagingPath)) {
    await NativeFile.unlink(stagingPath);
  }
};

export const restoreLegacyFiles = async (
  stagingPath: string,
  novelMappings: RestoredNovelMapping[],
  restoreRunId: string,
) => {
  await moveDirectoryContents(`${stagingPath}/Plugins`, PLUGIN_STORAGE);
  await restoreNovelFiles(`${stagingPath}/Novels`, novelMappings, restoreRunId);
  if (await NativeFile.exists(stagingPath)) {
    await NativeFile.unlink(stagingPath);
  }
};
