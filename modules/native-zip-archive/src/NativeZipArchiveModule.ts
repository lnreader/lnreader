import { requireNativeModule } from 'expo-modules-core';

type NativeZipArchiveModule = {
  unzip(sourceFilePath: string, distDirPath: string): Promise<void>;
  readEntry(sourcePath: string, entryName: string): Promise<string | null>;
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
