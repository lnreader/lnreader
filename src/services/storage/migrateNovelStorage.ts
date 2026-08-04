import NativeFile from '@modules/native-file';
import {
  NOVEL_STORAGE,
  setNovelStorageDirectory,
  toStorageFileUri,
} from '@utils/Storages';
import {
  copyStorageDirectory,
  countDirectoryFiles,
  joinStoragePath,
} from './directory';
import { dbManager } from '@database/db';
import { chapterSchema, novelSchema } from '@database/schema';
import { eq, sql } from 'drizzle-orm';
import type {
  MigrateDownloadStorageData,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import NativeBackgroundTasks from '@modules/native-background-tasks';
import { getMMKVObject, MMKVStorage, setMMKVObject } from '@utils/mmkv/mmkv';
import { getString } from '@i18n/translations';

export type NovelStorageMigrationProgress = {
  copiedFiles: number;
  totalFiles: number;
};

type ProgressListener = (progress: NovelStorageMigrationProgress) => void;

let migrationRunning = false;
const SAF_COVER_URI_REPAIR_KEY = 'SAF_COVER_URI_REPAIR_V3';

const splitCacheBuster = (uri: string) => {
  const match = uri.match(/(\?\d+)$/);
  return {
    path: match ? uri.slice(0, -match[1].length) : uri,
    suffix: match?.[1] ?? '',
  };
};

const canonicalizeCoverUri = async (cover: string) => {
  const { path, suffix } = splitCacheBuster(cover);
  const normalizedPath = path.startsWith('file://content://')
    ? path.slice('file://'.length)
    : path;
  if (!normalizedPath.startsWith('content://')) {
    return cover;
  }
  if (normalizedPath.includes('/document/')) return normalizedPath + suffix;
  return `${await NativeFile.resolveUri(normalizedPath)}${suffix}`;
};

const canonicalizeHtmlContentUris = async (html: string) => {
  let result = html;
  const uris = new Set(
    html.match(/(?:file:\/\/)?content:\/\/[^\s"'<>]+/g) ?? [],
  );
  for (const uri of uris) {
    result = result.replaceAll(uri, await canonicalizeCoverUri(uri));
  }
  return result;
};

export const repairStoredNovelCoverUris = async () => {
  if (MMKVStorage.getBoolean(SAF_COVER_URI_REPAIR_KEY)) return;
  try {
    const novels = await dbManager
      .select({ id: novelSchema.id, cover: novelSchema.cover })
      .from(novelSchema)
      .all();

    const repairs: { id: number; cover: string }[] = [];
    for (const novel of novels) {
      if (!novel.cover) continue;
      const cover = await canonicalizeCoverUri(novel.cover);
      if (cover !== novel.cover) repairs.push({ id: novel.id, cover });
    }

    if (repairs.length) {
      await dbManager.write(async tx => {
        for (const repair of repairs) {
          tx.update(novelSchema)
            .set({ cover: repair.cover })
            .where(eq(novelSchema.id, repair.id))
            .run();
        }
      });
    }
    MMKVStorage.set(SAF_COVER_URI_REPAIR_KEY, true);
  } catch {
    // A revoked or temporarily unavailable provider must not block app startup.
  }
};

const rewriteDownloadedHtmlPaths = async (
  directory: string,
  sourceRoot: string,
  destinationRoot: string,
): Promise<void> => {
  const entries = await NativeFile.readDir(directory);
  for (const entry of entries) {
    if (entry.isDirectory) {
      await rewriteDownloadedHtmlPaths(entry.path, sourceRoot, destinationRoot);
    } else if (entry.name === 'index.html') {
      const html = await NativeFile.readFile(entry.path);
      const migratedHtml = html
        .replaceAll(
          toStorageFileUri(sourceRoot),
          toStorageFileUri(destinationRoot),
        )
        .replaceAll(sourceRoot, toStorageFileUri(destinationRoot));
      await NativeFile.writeFile(
        entry.path,
        await canonicalizeHtmlContentUris(migratedHtml),
      );
    }
  }
};

const migrateDatabaseStorageReferences = async (
  sourceRoot: string,
  destinationRoot: string,
) => {
  const sourceUri = toStorageFileUri(sourceRoot);
  const novels = await dbManager
    .select({ id: novelSchema.id, cover: novelSchema.cover })
    .from(novelSchema)
    .all();
  const migratedCovers: { id: number; cover: string }[] = [];
  for (const novel of novels) {
    if (!novel.cover) continue;
    const migratedPath = novel.cover.startsWith(sourceUri)
      ? destinationRoot + novel.cover.slice(sourceUri.length)
      : novel.cover.startsWith(sourceRoot)
      ? destinationRoot + novel.cover.slice(sourceRoot.length)
      : undefined;
    if (!migratedPath) continue;
    migratedCovers.push({
      id: novel.id,
      cover: await canonicalizeCoverUri(migratedPath),
    });
  }

  await dbManager.write(async tx => {
    tx.update(novelSchema)
      .set({
        path: sql`replace(${novelSchema.path}, ${sourceRoot}, ${destinationRoot})`,
      })
      .run();
    tx.update(chapterSchema)
      .set({
        path: sql`replace(${chapterSchema.path}, ${sourceRoot}, ${destinationRoot})`,
      })
      .run();
    for (const novel of migratedCovers) {
      tx.update(novelSchema)
        .set({ cover: novel.cover })
        .where(eq(novelSchema.id, novel.id))
        .run();
    }
  });
};

export const migrateNovelStorage = async ({
  directoryName,
  directoryUri,
  onProgress,
}: {
  directoryName: string;
  directoryUri: string;
  onProgress?: ProgressListener;
}): Promise<string> => {
  if (migrationRunning) {
    throw new Error('A storage migration is already running.');
  }

  const selectedDirectory = directoryUri.replace(/\/$/, '');
  const destination = joinStoragePath(selectedDirectory, 'Novels');
  if (destination === NOVEL_STORAGE) return destination;

  migrationRunning = true;
  try {
    if (!(await NativeFile.exists(selectedDirectory))) {
      throw new Error('The selected directory is no longer accessible.');
    }

    const totalFiles = await countDirectoryFiles(NOVEL_STORAGE);
    const progress = { copiedFiles: 0, totalFiles };
    onProgress?.({ ...progress });

    if (await NativeFile.exists(NOVEL_STORAGE)) {
      await copyStorageDirectory(
        NOVEL_STORAGE,
        destination,
        progress,
        onProgress,
      );
    } else {
      await NativeFile.mkdir(destination);
    }

    await rewriteDownloadedHtmlPaths(destination, NOVEL_STORAGE, destination);

    const destinationFileCount = await countDirectoryFiles(destination);
    if (destinationFileCount < totalFiles) {
      throw new Error(
        `Storage verification failed: expected ${totalFiles} files, found ${destinationFileCount}.`,
      );
    }

    await migrateDatabaseStorageReferences(NOVEL_STORAGE, destination);
    setNovelStorageDirectory(destination, directoryName);
    return destination;
  } finally {
    migrationRunning = false;
  }
};

const setDirectoryForAutomaticBackups = async (
  directoryUri: string,
  directoryName: string,
) => {
  const settings = getMMKVObject<Record<string, unknown>>('APP_SETTINGS') ?? {};
  const intervalHours = Number(settings.automaticBackupIntervalHours ?? 0);
  setMMKVObject('APP_SETTINGS', {
    ...settings,
    automaticBackupDirectoryName: directoryName,
    automaticBackupDirectoryUri: directoryUri,
  });
  if (intervalHours > 0) {
    await NativeBackgroundTasks.scheduleAutomaticBackups(
      intervalHours,
      getString('notifications.LOCAL_BACKUP'),
      getString('common.preparing'),
      directoryUri,
    );
  }
};

export const migrateNovelStorageTask = async (
  data: MigrateDownloadStorageData,
  setMeta: TaskProgressUpdater,
) => {
  let lastPercentage = -1;
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
    progressText: getString('dataStorageScreen.storageMigrationPreparing'),
  }));

  await migrateNovelStorage({
    ...data,
    onProgress: ({ copiedFiles, totalFiles }) => {
      const percentage = Math.floor(
        (copiedFiles / Math.max(1, totalFiles)) * 100,
      );
      if (percentage === lastPercentage) return;
      lastPercentage = percentage;
      setMeta(meta => ({
        ...meta,
        isRunning: true,
        progress: copiedFiles / Math.max(1, totalFiles),
        progressText: getString('dataStorageScreen.storageMigrationProgress', {
          copied: copiedFiles,
          total: totalFiles,
        }),
      }));
    },
  });
  await setDirectoryForAutomaticBackups(data.directoryUri, data.directoryName);

  const completionText = getString(
    'dataStorageScreen.storageMigrationComplete',
  );
  setMeta(meta => ({
    ...meta,
    isRunning: false,
    progress: 1,
    progressText: completionText,
    completionText,
  }));
};
