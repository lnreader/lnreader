import { NOVEL_STORAGE, PLUGIN_STORAGE } from '@utils/Storages';
import NativeFile from '@modules/native-file';
import type { RestoredNovelMapping } from '@database/types';
import { getRestoreChapterMappings } from '@database/queries/NovelRestoreQueries';

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
  onProgress?: (completed: number, total: number) => void,
) => {
  const total = novelMappings.length + 1;
  for (const [index, mapping] of novelMappings.entries()) {
    const sourceNovelPath = `${stagingPath}/${mapping.pluginId}/${mapping.backupNovelId}`;
    if (!(await NativeFile.exists(sourceNovelPath))) {
      onProgress?.(index + 1, total);
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
    onProgress?.(index + 1, total);
  }

  if (await NativeFile.exists(stagingPath)) {
    await NativeFile.unlink(stagingPath);
  }
  onProgress?.(total, total);
};

export const restoreLegacyFiles = async (
  stagingPath: string,
  novelMappings: RestoredNovelMapping[],
  restoreRunId: string,
  onProgress?: (completed: number, total: number) => void,
) => {
  const total = novelMappings.length + 2;
  await moveDirectoryContents(`${stagingPath}/Plugins`, PLUGIN_STORAGE);
  await restoreNovelFiles(
    `${stagingPath}/Novels`,
    novelMappings,
    restoreRunId,
    onProgress ? completed => onProgress(completed, total) : undefined,
  );
  if (await NativeFile.exists(stagingPath)) {
    await NativeFile.unlink(stagingPath);
  }
  onProgress?.(total, total);
};
