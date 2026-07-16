import { ChapterInfo } from '@database/types';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { KeyContractInput, keyContract } from './keyContract';
import {
  defaultNovelSettings,
  defaultPageIndex,
  NovelSettings,
  LAST_READ_PREFIX,
  NOVEL_PAGE_INDEX_PREFIX,
  NOVEL_SETTINGS_PREFIX,
  NovelSettingsWithoutSort,
} from '../types';

export type NovelPersistenceInput = KeyContractInput;

interface NovelPersistenceStorage {
  getNumber: (key: string) => number | undefined;
  getString: (key: string) => string | undefined;
  set: (key: string, value: number | string | boolean) => void;
  delete: (key: string) => void;
}

const defaultStorage: NovelPersistenceStorage = {
  getNumber: key => MMKVStorage.getNumber(key),
  getString: key => MMKVStorage.getString(key),
  set: (key, value) => MMKVStorage.set(key, value),
  delete: key => MMKVStorage.remove(key),
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseJsonSafely = (value: string): unknown | undefined => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

const isValidNovelSettings = (value: unknown): value is NovelSettings => {
  if (!isRecord(value)) return false;
  if (!Array.isArray(value.filter)) return false;
  if (!value.filter.every(filter => typeof filter === 'string')) return false;
  if (value.sort !== undefined && typeof value.sort !== 'string') return false;
  if (
    value.showChapterTitles !== undefined &&
    typeof value.showChapterTitles !== 'boolean'
  ) {
    return false;
  }
  if (
    value.excludedScanlators !== undefined &&
    (!Array.isArray(value.excludedScanlators) ||
      !value.excludedScanlators.every(s => typeof s === 'string'))
  ) {
    return false;
  }
  return true;
};

const isValidChapterLike = (value: unknown): value is ChapterInfo => {
  return isRecord(value) && typeof value.id === 'number';
};

export const createNovelPersistenceBridge = (
  storage: NovelPersistenceStorage = defaultStorage,
) => {
  const keys = {
    pageIndex: (input: NovelPersistenceInput) => keyContract.pageIndex(input),
    settings: (input: NovelPersistenceInput) => keyContract.settings(input),
    lastRead: (input: NovelPersistenceInput) => keyContract.lastRead(input),
  };

  const readPageIndex = (input: NovelPersistenceInput): number => {
    const key = keys.pageIndex(input);
    const numberValue = storage.getNumber(key);

    if (typeof numberValue === 'number' && Number.isFinite(numberValue)) {
      return numberValue;
    }

    const stringValue = storage.getString(key);
    if (stringValue !== undefined) {
      const parsed = Number(stringValue);
      if (Number.isFinite(parsed)) {
        storage.set(key, parsed);
        return parsed;
      }
    }

    storage.set(key, defaultPageIndex);
    return defaultPageIndex;
  };

  const writePageIndex = (input: NovelPersistenceInput, value: number) => {
    const key = keys.pageIndex(input);
    const safeValue = Number.isFinite(value) ? value : defaultPageIndex;
    storage.set(key, safeValue);
  };

  const readSettings = (
    input: NovelPersistenceInput,
  ): NovelSettingsWithoutSort => {
    const key = keys.settings(input);
    const raw = storage.getString(key);
    if (raw === undefined) {
      return defaultNovelSettings;
    }

    const parsed = parseJsonSafely(raw);
    if (isValidNovelSettings(parsed)) {
      return parsed;
    }

    storage.delete(key);
    storage.set(key, JSON.stringify(defaultNovelSettings));
    return defaultNovelSettings;
  };

  const writeSettings = (
    input: NovelPersistenceInput,
    value: NovelSettingsWithoutSort,
  ) => {
    const key = keys.settings(input);
    storage.set(key, JSON.stringify(value));
  };

  const readLastRead = (
    input: NovelPersistenceInput,
  ): ChapterInfo | undefined => {
    const key = keys.lastRead(input);
    const raw = storage.getString(key);
    if (raw === undefined) {
      return undefined;
    }

    const parsed = parseJsonSafely(raw);
    if (isValidChapterLike(parsed)) {
      return parsed;
    }

    storage.delete(key);
    return undefined;
  };

  const writeLastRead = (input: NovelPersistenceInput, value: ChapterInfo) => {
    const key = keys.lastRead(input);
    storage.set(key, JSON.stringify(value));
  };

  const copySettings = (
    from: NovelPersistenceInput,
    to: NovelPersistenceInput,
  ) => {
    const settings = readSettings(from);
    if (settings) {
      writeSettings(to, settings);
    }
  };

  const copyLastRead = (
    from: NovelPersistenceInput,
    to: NovelPersistenceInput,
  ) => {
    const lastRead = readLastRead(from);
    if (lastRead) {
      writeLastRead(to, lastRead);
    }
  };

  return {
    keys,
    readPageIndex,
    writePageIndex,
    readSettings,
    writeSettings,
    readLastRead,
    writeLastRead,
    copySettings,
    copyLastRead,
  };
};

export const novelPersistence = createNovelPersistenceBridge();

export {
  defaultNovelSettings,
  defaultPageIndex,
  LAST_READ_PREFIX,
  NOVEL_PAGE_INDEX_PREFIX,
  NOVEL_SETTINGS_PREFIX,
  keyContract,
};
