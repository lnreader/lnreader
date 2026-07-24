import '../../../__tests__/mocks';
import { ChapterInfo } from '@database/types';
import {
  createNovelPersistenceBridge,
  defaultNovelSettings,
  defaultPageIndex,
  keyContract,
  LAST_READ_PREFIX,
  NOVEL_PAGE_INDEX_PREFIX,
  NOVEL_SETTINGS_PREFIX,
  novelPersistence,
} from '../store-helper/contracts';

jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: {
    enqueue: jest.fn(),
  },
}));

jest.mock('@database/db', () => ({
  dbManager: {
    write: jest.fn(),
  },
}));

const createStorage = () => {
  const numbers = new Map<string, number>();
  const strings = new Map<string, string>();

  return {
    numbers,
    strings,
    getNumber: (key: string) => numbers.get(key),
    getString: (key: string) => strings.get(key),
    set: (key: string, value: number | string | boolean) => {
      if (typeof value === 'number') {
        numbers.set(key, value);
        strings.delete(key);
        return;
      }

      strings.set(key, String(value));
      numbers.delete(key);
    },
    delete: (key: string) => {
      numbers.delete(key);
      strings.delete(key);
    },
  };
};

const sampleChapter: ChapterInfo = {
  id: 42,
  novelId: 7,
  name: 'Chapter 42',
  path: '/chapter/42',
  releaseTime: '2026-01-01',
  updatedTime: '2026-01-02',
  readTime: '2026-01-03',
  chapterNumber: 42,
  unread: false,
  isDownloaded: false,
  bookmark: true,
  progress: 70,
  page: '1',
  timeSpent: 0,
};

describe('novelPersistence bridge', () => {
  const input = {
    pluginId: 'webnovel',
    novelPath: 'api/novels/xyz-123',
  };

  it('reads legacy continuity keys for page/settings/lastRead', () => {
    const storage = createStorage();
    const bridge = createNovelPersistenceBridge(storage);

    const pageKey = `${NOVEL_PAGE_INDEX_PREFIX}_${input.pluginId}_${input.novelPath}`;
    const settingsKey = `${NOVEL_SETTINGS_PREFIX}_${input.pluginId}_${input.novelPath}`;
    const lastReadKey = `${LAST_READ_PREFIX}_${input.pluginId}_${input.novelPath}`;

    storage.numbers.set(pageKey, 5);
    storage.strings.set(settingsKey, JSON.stringify(defaultNovelSettings));
    storage.strings.set(lastReadKey, JSON.stringify(sampleChapter));

    expect(bridge.readPageIndex(input)).toBe(5);
    expect(bridge.readSettings(input)).toEqual(defaultNovelSettings);
    expect(bridge.readLastRead(input)).toEqual(sampleChapter);
  });

  it('keeps bridge key builders aligned with shared key contract exports', () => {
    const bridge = createNovelPersistenceBridge(createStorage());

    expect(bridge.keys.pageIndex(input)).toBe(
      `${NOVEL_PAGE_INDEX_PREFIX}_${input.pluginId}_${input.novelPath}`,
    );
    expect(bridge.keys.settings(input)).toBe(
      `${NOVEL_SETTINGS_PREFIX}_${input.pluginId}_${input.novelPath}`,
    );
    expect(bridge.keys.lastRead(input)).toBe(
      `${LAST_READ_PREFIX}_${input.pluginId}_${input.novelPath}`,
    );

    expect(bridge.keys.pageIndex(input)).toBe(keyContract.pageIndex(input));
    expect(bridge.keys.settings(input)).toBe(keyContract.settings(input));
    expect(bridge.keys.lastRead(input)).toBe(keyContract.lastRead(input));
  });

  it('recovers from corrupt persisted values with safe defaults', () => {
    const storage = createStorage();
    const bridge = createNovelPersistenceBridge(storage);

    const pageKey = bridge.keys.pageIndex(input);
    const settingsKey = bridge.keys.settings(input);
    const lastReadKey = bridge.keys.lastRead(input);

    storage.strings.set(pageKey, 'not-a-number');
    storage.strings.set(settingsKey, '{invalid-json');
    storage.strings.set(lastReadKey, JSON.stringify({ bad: 'shape' }));

    expect(bridge.readPageIndex(input)).toBe(defaultPageIndex);
    expect(bridge.readSettings(input)).toEqual(defaultNovelSettings);
    expect(bridge.readLastRead(input)).toBeUndefined();
    expect(storage.numbers.get(pageKey)).toBe(defaultPageIndex);
    expect(storage.strings.get(settingsKey)).toBe(
      JSON.stringify(defaultNovelSettings),
    );
    expect(storage.strings.has(lastReadKey)).toBe(false);
  });

  it('copies settings and lastRead via stable bridge API', () => {
    const storage = createStorage();
    const bridge = createNovelPersistenceBridge(storage);

    const from = {
      pluginId: 'source-plugin',
      novelPath: 'source/path',
    };
    const to = {
      pluginId: 'target-plugin',
      novelPath: 'target/path',
    };

    storage.strings.set(
      bridge.keys.settings(from),
      JSON.stringify(defaultNovelSettings),
    );
    storage.strings.set(
      bridge.keys.lastRead(from),
      JSON.stringify(sampleChapter),
    );

    bridge.copySettings(from, to);
    bridge.copyLastRead(from, to);

    expect(storage.strings.get(bridge.keys.settings(to))).toBe(
      JSON.stringify(defaultNovelSettings),
    );
    expect(storage.strings.get(bridge.keys.lastRead(to))).toBe(
      JSON.stringify(sampleChapter),
    );
  });

  it('keeps migrate contract usage compile-safe through stable exports', () => {
    const { migrateNovel } = require('@services/migrate/migrateNovel');

    expect(typeof novelPersistence.copySettings).toBe('function');
    expect(typeof novelPersistence.readLastRead).toBe('function');
    expect(typeof migrateNovel).toBe('function');
  });
});
