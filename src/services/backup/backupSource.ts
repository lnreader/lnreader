import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';

/**
 * Read access to a backup's contents by paths relative to its root, whether
 * the backup was unpacked into a folder or is read straight from its archive.
 */
export type BackupSource = {
  exists(path: string): Promise<boolean>;
  fileSize(path: string): Promise<number>;
  readFile(path: string): Promise<string>;
  readDir(path: string): Promise<{ name: string; isDirectory: boolean }[]>;
  /** Puts the file at `destinationPath`; the source may no longer have it. */
  takeFile(path: string, destinationPath: string): Promise<void>;
};

export const createFolderBackupSource = (root: string): BackupSource => ({
  exists: path => NativeFile.exists(`${root}/${path}`),
  fileSize: path => NativeFile.fileSize(`${root}/${path}`),
  readFile: path => NativeFile.readFile(`${root}/${path}`),
  readDir: path => NativeFile.readDir(`${root}/${path}`),
  // Unpacked files are working copies, so they are moved rather than copied.
  takeFile: (path, destinationPath) =>
    NativeFile.moveFile(`${root}/${path}`, destinationPath),
});

export const createArchiveBackupSource = (handle: number): BackupSource => ({
  exists: path => NativeZipArchive.archiveEntryExists(handle, path),
  fileSize: path => NativeZipArchive.archiveEntrySize(handle, path),
  readFile: path => NativeZipArchive.readArchiveFile(handle, path),
  readDir: path => NativeZipArchive.readArchiveDir(handle, path),
  takeFile: (path, destinationPath) =>
    NativeZipArchive.extractArchiveFile(handle, path, destinationPath),
});
