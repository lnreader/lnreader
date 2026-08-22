import NativeFile from '@modules/native-file';

export type DirectoryCopyProgress = {
  copiedFiles: number;
  totalFiles: number;
};

export const isSafDirectory = (path: string) => path.startsWith('content://');

export const joinStoragePath = (parent: string, child: string) =>
  `${parent.replace(/\/$/, '')}/${child}`;

export const countDirectoryFiles = async (
  directory: string,
): Promise<number> => {
  if (!(await NativeFile.exists(directory))) return 0;

  const entries = await NativeFile.readDir(directory);
  let total = 0;
  for (const entry of entries) {
    total += entry.isDirectory ? await countDirectoryFiles(entry.path) : 1;
  }
  return total;
};

export const copyStorageDirectory = async (
  source: string,
  destination: string,
  progress?: DirectoryCopyProgress,
  onProgress?: (progress: DirectoryCopyProgress) => void,
): Promise<void> => {
  await NativeFile.mkdir(destination);
  const entries = await NativeFile.readDir(source);

  for (const entry of entries) {
    const destinationPath = joinStoragePath(destination, entry.name);
    if (entry.isDirectory) {
      await copyStorageDirectory(
        entry.path,
        destinationPath,
        progress,
        onProgress,
      );
      continue;
    }

    await NativeFile.copyFile(entry.path, destinationPath);
    if (!(await NativeFile.exists(destinationPath))) {
      throw new Error(`Failed to verify copied file: ${entry.name}`);
    }
    if (progress) {
      progress.copiedFiles += 1;
      onProgress?.({ ...progress });
    }
  }
};

export const materializeStorageDirectory = async (
  source: string,
  cacheDirectory: string,
): Promise<string> => {
  if (!isSafDirectory(source)) return source;
  if (await NativeFile.exists(cacheDirectory)) {
    await NativeFile.unlink(cacheDirectory);
  }
  await copyStorageDirectory(source, cacheDirectory);
  return cacheDirectory;
};

export const prepareStorageRestoreDirectory = async (
  destination: string,
  cacheDirectory: string,
): Promise<string> => {
  if (!isSafDirectory(destination)) return destination;
  if (await NativeFile.exists(cacheDirectory)) {
    await NativeFile.unlink(cacheDirectory);
  }
  await NativeFile.mkdir(cacheDirectory);
  return cacheDirectory;
};

export const finalizeStorageRestoreDirectory = async (
  extractedDirectory: string,
  destination: string,
): Promise<void> => {
  if (!isSafDirectory(destination)) return;
  await copyStorageDirectory(extractedDirectory, destination);
};

export const cleanupStagedStorageDirectory = async (
  stagedDirectory: string,
  storageDirectory: string,
): Promise<void> => {
  if (stagedDirectory === storageDirectory) return;
  try {
    if (await NativeFile.exists(stagedDirectory)) {
      await NativeFile.unlink(stagedDirectory);
    }
  } catch {
    // Cache cleanup must not replace the original backup or restore result.
  }
};
