import NativeFileModule, {
  type DirectorySelection,
  type FileCopyResult,
  type ReadDirResult,
} from './src/NativeFileModule';

const NativeFile = {
  DocumentDirectoryPath: NativeFileModule.DocumentDirectoryPath,
  ExternalDirectoryPath: NativeFileModule.ExternalDirectoryPath,
  ExternalCachesDirectoryPath: NativeFileModule.ExternalCachesDirectoryPath,
  createDocument: NativeFileModule.createDocument.bind(NativeFileModule),
  pickDocument: NativeFileModule.pickDocument.bind(NativeFileModule),
  pickDirectory: NativeFileModule.pickDirectory.bind(NativeFileModule),
  writeFile: NativeFileModule.writeFile.bind(NativeFileModule),
  readFile: NativeFileModule.readFile.bind(NativeFileModule),
  copyFile: NativeFileModule.copyFile.bind(NativeFileModule),
  copyFileToDirectory:
    NativeFileModule.copyFileToDirectory.bind(NativeFileModule),
  moveFile: NativeFileModule.moveFile.bind(NativeFileModule),
  exists: NativeFileModule.exists.bind(NativeFileModule),
  mkdir: NativeFileModule.mkdir.bind(NativeFileModule),
  unlink: NativeFileModule.unlink.bind(NativeFileModule),
  readDir: NativeFileModule.readDir.bind(NativeFileModule),
  resolveUri: NativeFileModule.resolveUri.bind(NativeFileModule),
  downloadFile: NativeFileModule.downloadFile.bind(NativeFileModule),
};

export type { DirectorySelection, FileCopyResult, ReadDirResult };
export default NativeFile;
