import { NOVEL_STORAGE, PLUGIN_STORAGE } from '@utils/Storages';
import type { BackupOptions } from './options';
import { ZipBackupName } from './types';
import NativeFile from '@modules/native-file';
import type { RestoredNovelMapping } from '@database/types';

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

export const EMPTY_SECTION_MARKER = '.lnreader-empty-section';

const containsFile = async (directory: string): Promise<boolean> => {
  if (!(await NativeFile.exists(directory))) {
    return false;
  }
  for (const item of await NativeFile.readDir(directory)) {
    if (!item.isDirectory || (await containsFile(item.path))) {
      return true;
    }
  }
  return false;
};

// Android 9 and older cannot write (or open) a zip with no entries, so an empty
// section is archived with one marker file; restore removes the marker again.
export const getBackupSectionSource = async (
  section: BackupFileSection,
): Promise<string> => {
  if (await containsFile(section.storagePath)) {
    return section.storagePath;
  }
  const stagingPath = `${NativeFile.ExternalCachesDirectoryPath}/BackupEmptySection-${section.archiveName}`;
  if (await NativeFile.exists(stagingPath)) {
    await NativeFile.unlink(stagingPath);
  }
  await NativeFile.mkdir(stagingPath);
  await NativeFile.writeFile(`${stagingPath}/${EMPTY_SECTION_MARKER}`, '');
  return stagingPath;
};

export const extractSectionArchive = async (
  extract: () => Promise<unknown>,
) => {
  try {
    await extract();
  } catch (error: any) {
    // Android 9 and older refuse to open a zip with no entries.
    if (error?.message !== 'No entries') {
      throw error;
    }
  }
};

export const removeEmptySectionMarker = async (destination: string) => {
  const markerPath = `${destination}/${EMPTY_SECTION_MARKER}`;
  if (await NativeFile.exists(markerPath)) {
    await NativeFile.unlink(markerPath);
  }
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

export const restoreNovelFiles = async (
  stagingPath: string,
  novelMappings: RestoredNovelMapping[],
) => {
  for (const mapping of novelMappings) {
    const sourceNovelPath = `${stagingPath}/${mapping.pluginId}/${mapping.backupNovelId}`;
    if (!(await NativeFile.exists(sourceNovelPath))) {
      continue;
    }

    const destinationNovelPath = `${NOVEL_STORAGE}/${mapping.pluginId}/${mapping.restoredNovelId}`;
    await NativeFile.mkdir(destinationNovelPath);
    const chapterIds = new Map(
      mapping.chapters.map(chapter => [
        String(chapter.backupChapterId),
        chapter.restoredChapterId,
      ]),
    );

    for (const item of await NativeFile.readDir(sourceNovelPath)) {
      if (!item.isDirectory) {
        await NativeFile.moveFile(
          item.path,
          `${destinationNovelPath}/${item.name}`,
        );
        continue;
      }

      const restoredChapterId = chapterIds.get(item.name);
      if (restoredChapterId !== undefined) {
        await moveDirectoryContents(
          item.path,
          `${destinationNovelPath}/${restoredChapterId}`,
        );
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
) => {
  await moveDirectoryContents(`${stagingPath}/Plugins`, PLUGIN_STORAGE);
  await restoreNovelFiles(`${stagingPath}/Novels`, novelMappings);
  if (await NativeFile.exists(stagingPath)) {
    await NativeFile.unlink(stagingPath);
  }
};
