import { TurboModule, TurboModuleRegistry } from 'react-native';

interface ReadDirResult {
  name: string;
  path: string;
  isDirectory: boolean; // int
}

export interface Spec extends TurboModule {
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  copyFile: (sourcePath: string, destPath: string) => Promise<void>;
  moveFile: (sourcePath: string, destPath: string) => Promise<void>;
  exists: (filePath: string) => Promise<boolean>;
  /**
   * @description create parents, and do nothing if exists;
   */
  mkdir: (filePath: string) => Promise<void>;
  /**
   * @description remove recursively
   */
  unlink: (filePath: string) => Promise<void>;
  readDir: (dirPath: string) => Promise<ReadDirResult[]>;
  createDocument: (filename: string, mimeType: string) => Promise<string>;
  pickDocument: (mimeType: string) => Promise<string>;
  downloadFile: (
    url: string,
    destPath: string,
    method: string,
    headers: { [key: string]: string } | Headers,
    body?: string,
  ) => Promise<void>;
  getConstants: () => {
    ExternalDirectoryPath: string;
    ExternalCachesDirectoryPath: string;
  };
}

export default TurboModuleRegistry.getEnforcing<Spec>('NativeFile');
