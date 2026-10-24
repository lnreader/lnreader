import { requireNativeModule } from 'expo-modules-core';

export type UnzipCategoryStats = {
  fileCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
};

export type UnzipStats = UnzipCategoryStats & {
  largestUncompressedEntryBytes: number;
  elapsedMs: number;
  categories: Record<
    'NovelAndChapters' | 'Covers' | 'NovelFiles' | 'other',
    UnzipCategoryStats
  >;
};

type NativeZipArchiveModule = {
  unzip(sourceFilePath: string, distDirPath: string): Promise<UnzipStats>;
  zip(sourceDirPath: string, zipFilePath: string): Promise<void>;
  zipDirectories(
    sources: { path: string; prefix: string }[],
    zipFilePath: string,
  ): Promise<void>;
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
