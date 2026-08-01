import NativeFile from '@modules/native-file';
import { MMKVStorage } from './mmkv/mmkv';

export const ROOT_STORAGE = NativeFile.ExternalDirectoryPath;
export const PLUGIN_STORAGE = ROOT_STORAGE + '/Plugins';
export const NOVEL_STORAGE_DIRECTORY_KEY = 'NOVEL_STORAGE_DIRECTORY';
export const NOVEL_STORAGE_DIRECTORY_NAME_KEY = 'NOVEL_STORAGE_DIRECTORY_NAME';

export const DEFAULT_NOVEL_STORAGE = ROOT_STORAGE + '/Novels';

export let NOVEL_STORAGE =
  MMKVStorage.getString(NOVEL_STORAGE_DIRECTORY_KEY) ?? DEFAULT_NOVEL_STORAGE;

export const setNovelStorageDirectory = (directory: string, name?: string) => {
  NOVEL_STORAGE = directory;
  MMKVStorage.set(NOVEL_STORAGE_DIRECTORY_KEY, directory);
  if (name) {
    MMKVStorage.set(NOVEL_STORAGE_DIRECTORY_NAME_KEY, name);
  } else {
    MMKVStorage.remove(NOVEL_STORAGE_DIRECTORY_NAME_KEY);
  }
};

export const getNovelStorageDirectoryName = () =>
  MMKVStorage.getString(NOVEL_STORAGE_DIRECTORY_NAME_KEY);

export const toStorageFileUri = (path: string) =>
  path.startsWith('content://') || path.startsWith('file://')
    ? path
    : `file://${path}`;
