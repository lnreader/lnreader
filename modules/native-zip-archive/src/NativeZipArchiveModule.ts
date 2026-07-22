import { requireNativeModule } from 'expo-modules-core';

type NativeZipArchiveModule = {
  unzip(sourceFilePath: string, distDirPath: string): Promise<void>;
  zip(sourceDirPath: string, zipFilePath: string): Promise<void>;
  remoteUnzip(
    distDirPath: string,
    urlString: string,
    headers: Record<string, string>,
  ): Promise<void>;
  remoteZip(
    sourceDirPath: string,
    urlString: string,
    headers: Record<string, string>,
  ): Promise<void>;
};

export default requireNativeModule<NativeZipArchiveModule>('NativeZipArchive');