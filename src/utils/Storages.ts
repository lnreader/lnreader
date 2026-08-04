import NativeFile from '@modules/native-file';

const documentStorage =
  NativeFile.DocumentDirectoryPath || NativeFile.ExternalDirectoryPath;

export const ROOT_STORAGE = NativeFile.ExternalDirectoryPath || documentStorage;
export const LEGACY_PLUGIN_STORAGE = ROOT_STORAGE + '/Plugins';
export const PLUGIN_STORAGE = documentStorage + '/Plugins';
export const NOVEL_STORAGE = ROOT_STORAGE + '/Novels';
