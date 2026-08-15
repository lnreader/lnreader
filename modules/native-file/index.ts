import { Platform } from 'react-native';
import SafX from 'react-native-saf-x';
import NativeFileModule from './src/NativeFileModule';
import type {
  DirectorySelection,
  FileCopyResult,
  ReadDirResult,
} from './src/NativeFileModule';
import { toSafDocumentUri } from './safUri';

const isSafPath = (path: string) =>
  Platform.OS === 'android' && path.startsWith('content://');

const toSafPath = (path: string) =>
  path.startsWith('file://') || path.startsWith('content://')
    ? path
    : `file://${path}`;

const NativeFile = {
  DocumentDirectoryPath: NativeFileModule.DocumentDirectoryPath,
  ExternalDirectoryPath: NativeFileModule.ExternalDirectoryPath,
  ExternalCachesDirectoryPath: NativeFileModule.ExternalCachesDirectoryPath,
  createDocument: NativeFileModule.createDocument.bind(NativeFileModule),
  pickDocument: NativeFileModule.pickDocument.bind(NativeFileModule),
  pickDirectory: NativeFileModule.pickDirectory.bind(NativeFileModule),
  writeFile: (path: string, content: string): Promise<void> =>
    isSafPath(path)
      ? SafX.writeFile(path, content, { encoding: 'utf8' })
      : NativeFileModule.writeFile(path, content),
  readFile: (path: string): Promise<string> =>
    isSafPath(path)
      ? SafX.readFile(path, { encoding: 'utf8' })
      : NativeFileModule.readFile(path),
  copyFile: async (source: string, destination: string): Promise<void> => {
    if (isSafPath(source) || isSafPath(destination)) {
      await SafX.copyFile(toSafPath(source), toSafPath(destination), {
        replaceIfDestinationExists: true,
      });
      return;
    }
    await NativeFileModule.copyFile(source, destination);
  },
  copyFileToDirectory:
    NativeFileModule.copyFileToDirectory.bind(NativeFileModule),
  moveFile: async (source: string, destination: string): Promise<void> => {
    if (isSafPath(source) || isSafPath(destination)) {
      await SafX.moveFile(toSafPath(source), toSafPath(destination), {
        replaceIfDestinationExists: true,
      });
      return;
    }
    await NativeFileModule.moveFile(source, destination);
  },
  exists: (path: string): Promise<boolean> =>
    isSafPath(path) ? SafX.exists(path) : NativeFileModule.exists(path),
  mkdir: async (path: string): Promise<void> => {
    if (isSafPath(path)) {
      await SafX.mkdir(path);
      return;
    }
    await NativeFileModule.mkdir(path);
  },
  unlink: async (path: string): Promise<void> => {
    if (isSafPath(path)) {
      await SafX.unlink(path);
      return;
    }
    await NativeFileModule.unlink(path);
  },
  readDir: async (path: string): Promise<ReadDirResult[]> => {
    if (!isSafPath(path)) return NativeFileModule.readDir(path);
    const entries = await SafX.listFiles(path);
    return entries.map(entry => ({
      name: entry.name,
      path: entry.uri,
      isDirectory: entry.type === 'directory',
    }));
  },
  resolveUri: async (path: string): Promise<string> => {
    if (isSafPath(path)) {
      return toSafDocumentUri((await SafX.stat(path)).uri);
    }
    return path.startsWith('file://') ? path : `file://${path}`;
  },
  downloadFile: async (
    url: string,
    destination: string,
    method: string,
    headers: Record<string, string>,
    body?: string,
  ): Promise<void> => {
    if (!isSafPath(destination)) {
      await NativeFileModule.downloadFile(
        url,
        destination,
        method,
        headers,
        body,
      );
      return;
    }

    const temporaryPath = `${
      NativeFileModule.ExternalCachesDirectoryPath
    }/saf-download-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    try {
      await NativeFileModule.downloadFile(
        url,
        temporaryPath,
        method,
        headers,
        body,
      );
      await SafX.copyFile(`file://${temporaryPath}`, destination, {
        replaceIfDestinationExists: true,
      });
    } finally {
      if (await NativeFileModule.exists(temporaryPath)) {
        await NativeFileModule.unlink(temporaryPath);
      }
    }
  },
};

export type { DirectorySelection, FileCopyResult, ReadDirResult };
export default NativeFile;
