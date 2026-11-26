import { requireNativeModule } from 'expo-modules-core';

export type ArchiveDirItem = {
  name: string;
  path: string;
  isDirectory: boolean;
};

type NativeZipArchiveModule = {
  unzip(sourceFilePath: string, distDirPath: string): Promise<void>;
  readEntry(sourcePath: string, entryName: string): Promise<string | null>;
  /**
   * Opens an archive for reading entries in place. Paths below are relative
   * to the archive root, as unzip would extract them. Rejects with code
   * NOT_SEEKABLE when the source can only be streamed.
   */
  openArchive(sourcePath: string): Promise<number>;
  closeArchive(handle: number): Promise<void>;
  archiveEntryExists(handle: number, path: string): Promise<boolean>;
  archiveEntrySize(handle: number, path: string): Promise<number>;
  readArchiveDir(handle: number, path: string): Promise<ArchiveDirItem[]>;
  readArchiveFile(handle: number, path: string): Promise<string>;
  extractArchiveFile(
    handle: number,
    path: string,
    destPath: string,
  ): Promise<void>;
  zip(sourceDirPath: string, zipFilePath: string): Promise<void>;
  remoteUnzip(
    distDirPath: string,
    urlString: string,
    headers: Record<string, string>,
  ): Promise<string>;
  remoteZip(
    sourceDirPath: string,
    urlString: string,
    headers: Record<string, string>,
  ): Promise<string>;
};

export default requireNativeModule<NativeZipArchiveModule>('NativeZipArchive');
