import { requireNativeModule } from 'expo-modules-core';

export type ReadDirResult = {
  name: string;
  path: string;
  isDirectory: boolean;
};

type NativeFileModule = {
  ExternalDirectoryPath: string;
  ExternalCachesDirectoryPath: string;
  createDocument(filename: string, mimeType: string): Promise<string>;
  pickDocument(mimeType: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  copyFile(filepath: string, destPath: string): Promise<void>;
  moveFile(filepath: string, destPath: string): Promise<void>;
  exists(filepath: string): Promise<boolean>;
  mkdir(filepath: string): Promise<void>;
  unlink(filepath: string): Promise<void>;
  readDir(directory: string): Promise<ReadDirResult[]>;
  downloadFile(
    url: string,
    destPath: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<void>;
};

export default requireNativeModule<NativeFileModule>('NativeFile');