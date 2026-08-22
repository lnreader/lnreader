import NativeFile from '@modules/native-file';
import NativeBackgroundTasks from '@modules/native-background-tasks';
import {
  migrateNovelStorage,
  migrateNovelStorageTask,
  repairStoredNovelCoverUris,
} from '../migrateNovelStorage';
import { setNovelStorageDirectory } from '@utils/Storages';

jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: {
    exists: jest.fn(),
    readDir: jest.fn(),
    mkdir: jest.fn(),
    copyFile: jest.fn(),
    readFile: jest.fn().mockResolvedValue('<html />'),
    writeFile: jest.fn(),
    resolveUri: jest.fn(async (path: string) =>
      path.replace('/tree/', '/tree/root/document/'),
    ),
  },
}));

jest.mock('@modules/native-background-tasks', () => ({
  __esModule: true,
  default: { scheduleAutomaticBackups: jest.fn() },
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(() => ({ automaticBackupIntervalHours: 12 })),
  setMMKVObject: jest.fn(),
  MMKVStorage: { getBoolean: jest.fn(() => false), set: jest.fn() },
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/old/Novels',
  setNovelStorageDirectory: jest.fn(),
  toStorageFileUri: (path: string) =>
    path.startsWith('content://') ? path : `file://${path}`,
}));

const mockUpdateRun = jest.fn();
const mockUpdateWhere = jest.fn(() => ({ run: mockUpdateRun }));
const mockUpdateSet = jest.fn(() => ({
  run: mockUpdateRun,
  where: mockUpdateWhere,
}));
const mockUpdate = jest.fn(() => ({ set: mockUpdateSet }));
let mockNovels: { id: number; cover: string | null }[] = [];

jest.mock('@database/db', () => ({
  dbManager: {
    select: jest.fn(() => ({
      from: jest.fn(() => ({ all: jest.fn(() => mockNovels) })),
    })),
    write: (callback: (tx: { update: typeof mockUpdate }) => unknown) =>
      callback({ update: mockUpdate }),
  },
}));

jest.mock('@database/schema', () => ({
  novelSchema: { id: 'id', cover: 'cover', path: 'novelPath' },
  chapterSchema: { path: 'chapterPath' },
}));

jest.mock('drizzle-orm', () => ({
  sql: (parts: TemplateStringsArray) => parts.join('?'),
  eq: jest.fn(() => 'where'),
}));

describe('migrateNovelStorage', () => {
  beforeEach(() => {
    mockNovels = [];
    jest.clearAllMocks();
  });

  it('copies and verifies existing files before switching storage', async () => {
    jest.mocked(NativeFile.exists).mockImplementation(async path => {
      return [
        'content://picked',
        'content://picked/Novels',
        '/old/Novels',
        'content://picked/Novels/index.html',
      ].includes(path);
    });
    jest.mocked(NativeFile.readDir).mockImplementation(async path => {
      if (path === '/old/Novels') {
        return [
          {
            name: 'index.html',
            path: '/old/Novels/index.html',
            isDirectory: false,
          },
        ];
      }
      if (path === 'content://picked/Novels') {
        return [
          {
            name: 'index.html',
            path: 'content://picked/Novels/index.html',
            isDirectory: false,
          },
        ];
      }
      return [];
    });

    await migrateNovelStorage({
      directoryName: 'LNReader',
      directoryUri: 'content://picked',
    });

    expect(NativeFile.copyFile).toHaveBeenCalledWith(
      '/old/Novels/index.html',
      'content://picked/Novels/index.html',
    );
    expect(setNovelStorageDirectory).toHaveBeenCalledWith(
      'content://picked/Novels',
      'LNReader',
    );
  });

  it('does not switch storage when verification fails', async () => {
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path =>
        ['content://picked', '/old/Novels'].includes(path),
      );
    jest.mocked(NativeFile.readDir).mockResolvedValue([
      {
        name: 'index.html',
        path: '/old/Novels/index.html',
        isDirectory: false,
      },
    ]);

    await expect(
      migrateNovelStorage({
        directoryName: 'LNReader',
        directoryUri: 'content://picked',
      }),
    ).rejects.toThrow('Failed to verify copied file');
    expect(setNovelStorageDirectory).not.toHaveBeenCalled();
  });

  it('reports background progress and moves automatic backups', async () => {
    jest
      .mocked(NativeFile.exists)
      .mockImplementation(async path =>
        [
          'content://picked',
          'content://picked/Novels',
          '/old/Novels',
          'content://picked/Novels/index.html',
        ].includes(path),
      );
    jest.mocked(NativeFile.readDir).mockImplementation(async path => {
      if (path === '/old/Novels') {
        return [
          {
            name: 'index.html',
            path: '/old/Novels/index.html',
            isDirectory: false,
          },
        ];
      }
      if (path === 'content://picked/Novels') {
        return [
          {
            name: 'index.html',
            path: 'content://picked/Novels/index.html',
            isDirectory: false,
          },
        ];
      }
      return [];
    });
    let metadata = {
      name: 'Moving storage',
      isRunning: false,
      progress: undefined as number | undefined,
      progressText: undefined as string | undefined,
    };

    await migrateNovelStorageTask(
      { directoryName: 'LNReader', directoryUri: 'content://picked' },
      transformer => {
        metadata = transformer(metadata);
      },
    );

    expect(metadata).toMatchObject({ isRunning: false, progress: 1 });
    expect(NativeBackgroundTasks.scheduleAutomaticBackups).toHaveBeenCalledWith(
      12,
      'notifications.LOCAL_BACKUP',
      'common.preparing',
      'content://picked',
    );
  });

  it('repairs synthetic SAF cover URIs from an earlier migration', async () => {
    mockNovels = [
      {
        id: 7,
        cover: 'content://provider/tree/library/Novels/source/7/cover.png?123',
      },
    ];

    await repairStoredNovelCoverUris();

    expect(NativeFile.resolveUri).toHaveBeenCalledWith(
      'content://provider/tree/library/Novels/source/7/cover.png',
    );
    expect(mockUpdateSet).toHaveBeenCalledWith({
      cover:
        'content://provider/tree/root/document/library/Novels/source/7/cover.png?123',
    });
  });
});
