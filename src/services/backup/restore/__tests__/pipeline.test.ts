import {
  _restoreNovelAndChapters,
  _restoreNovelsAndChapters,
  clearRestoreChapterMappings,
} from '@database/queries/NovelRestoreQueries';
import { _restoreCategory } from '@database/queries/CategoryQueries';
import type {
  BackupNovel,
  ChapterInfo,
  RestoredNovelMapping,
} from '@database/types';
import NativeFile from '@modules/native-file';
import { restoreData } from '../index';
import { restoreNovels } from '../novels';
import { encodeNovelBatch } from '../../novelPayload';
import type {
  BackgroundTaskMetadata,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { createRestoreProgressReporter } from '../progress';

jest.mock('@database/queries/NovelRestoreQueries', () => ({
  _restoreNovelAndChapters: jest.fn(),
  _restoreNovelsAndChapters: jest.fn(),
  clearRestoreChapterMappings: jest.fn(async () => undefined),
}));
jest.mock('@database/queries/CategoryQueries', () => ({
  _restoreCategory: jest.fn(),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string, options?: Record<string, string | number>) => {
    if (options?.current === undefined) {
      return key;
    }
    return options.total === undefined
      ? `${key}:${options.current}`
      : `${key}:${options.current}/${options.total}`;
  },
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getAllKeys: jest.fn(() => []),
    getBoolean: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@plugins/pluginManager', () => ({
  INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/storage/Novels',
  ROOT_STORAGE: '/storage',
}));

const options = {
  library: true,
  settings: false,
  plugins: false,
  downloadedFiles: true,
};

const makeTestChapter = (novelId: number): ChapterInfo => ({
  id: novelId * 100 + 1,
  novelId,
  path: `/novel/${novelId}/chapter/1`,
  name: `Chapter ${novelId}`,
  releaseTime: null,
  readTime: null,
  bookmark: null,
  unread: null,
  isDownloaded: true,
  updatedTime: null,
  chapterNumber: 1,
  page: null,
  position: null,
  progress: null,
  scanlator: null,
  timeSpent: 0,
});

const makeTestNovel = (id: number, path = `/novel/${id}`): BackupNovel => ({
  id,
  name: `Novel ${id}`,
  path,
  pluginId: 'source',
  cover: null,
  summary: null,
  author: null,
  artist: null,
  status: null,
  genres: null,
  inLibrary: true,
  isLocal: false,
  totalPages: null,
  chapters: [makeTestChapter(id)],
});

const makeMappings = (novels: BackupNovel[]): RestoredNovelMapping[] =>
  novels.map(novel => ({
    pluginId: novel.pluginId,
    backupNovelId: novel.id,
    restoredNovelId: novel.id + 10_000,
  }));

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const manifestContent = JSON.stringify({
  appVersion: '2.1.3',
  formatVersion: 2,
  novelDataFormat: 2,
  sections: options,
});

const configureFiles = (
  files: Record<string, string>,
  manifest = manifestContent,
) => {
  jest
    .mocked(NativeFile.exists)
    .mockImplementation(
      async path =>
        path === '/cache/NovelAndChapters' || path === '/cache/Category.json',
    );
  jest.mocked(NativeFile.readDir).mockResolvedValue(
    Object.keys(files)
      .reverse()
      .map(name => ({
        name,
        path: `/cache/NovelAndChapters/${name}`,
        isDirectory: false,
      })),
  );
  jest.mocked(NativeFile.readFile).mockImplementation(async path => {
    if (path === '/cache/Version.json') {
      return manifest;
    }
    if (path === '/cache/Category.json') {
      return JSON.stringify([
        { id: 8, name: 'Reading list', novelIds: [1, 100, 200, 201] },
      ]);
    }
    return files[path.split('/').pop() ?? ''];
  });
};

const createProgressCapture = () => {
  let metadata: BackgroundTaskMetadata = {
    name: 'LOCAL_RESTORE',
    isRunning: true,
    progress: undefined,
    progressText: undefined,
  };
  const progressValues: number[] = [];
  const progressTexts: string[] = [];
  const setMeta: TaskProgressUpdater = transform => {
    metadata = transform(metadata);
    if (metadata.progress !== undefined) {
      progressValues.push(metadata.progress);
    }
    if (metadata.progressText !== undefined) {
      progressTexts.push(metadata.progressText);
    }
  };
  return {
    progressValues,
    progressTexts,
    reporter: createRestoreProgressReporter(setMeta, 'local'),
  };
};

const getNovelReadPaths = () =>
  jest
    .mocked(NativeFile.readFile)
    .mock.calls.map(([path]) => path)
    .filter(path => path.includes('/NovelAndChapters/'));

describe('bounded novel restore pipeline', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('settles progress and logs zeroed metrics when the novel directory is absent', async () => {
    jest.mocked(NativeFile.exists).mockResolvedValue(false);
    const events: string[] = [];
    const capture = createProgressCapture();
    const result = await restoreNovels(
      '/cache',
      {
        appVersion: '2.1.3',
        formatVersion: 2,
        novelDataFormat: 2,
        sections: options,
      },
      'restore-run',
      capture.reporter,
      event => {
        events.push(event);
      },
    );

    expect(result.failedSectionCount).toBe(1);
    expect(capture.progressTexts).toContain('backupScreen.restoringNovels');
    expect(
      capture.progressValues[capture.progressValues.length - 1],
    ).toBeCloseTo(0.982);
    const summaryPrefix = 'restoreData:database:summary ';
    const summaryEvent = events.find(event => event.startsWith(summaryPrefix));
    expect(summaryEvent).toBeDefined();
    expect(JSON.parse(summaryEvent!.slice(summaryPrefix.length))).toMatchObject(
      {
        uniqueInputChapterCount: 0,
        novelUpsertCalls: 0,
        novelIdentityLookupCalls: 0,
        chapterWriteChunkCalls: 0,
        chapterMappingRowsAttempted: 0,
        statsRefreshCalls: 0,
        novelBatchFallbacks: 0,
        chapterBatchFallbacks: 0,
        fallbackCauses: [],
      },
    );
  });

  it('completes the progress ranges for omitted library, settings, and plugins', async () => {
    const manifest = JSON.stringify({
      appVersion: '2.1.3',
      formatVersion: 3,
      novelDataFormat: 2,
      sections: {
        library: false,
        settings: false,
        plugins: false,
        downloadedFiles: false,
      },
    });
    configureFiles({}, manifest);
    const capture = createProgressCapture();

    await restoreData('/cache', capture.reporter);

    expect(capture.progressTexts).toContain('backupScreen.restoringNovels');
    expect(capture.progressTexts).toContain('backupScreen.restoringCategories');
    expect(capture.progressTexts).toContain('backupScreen.restoringSettings');
    expect(capture.progressTexts).toContain('backupScreen.restoringPlugins');
    expect(
      capture.progressValues[capture.progressValues.length - 1],
    ).toBeLessThan(1);
  });

  it('keeps the 25-novel denominator until mappings persist', async () => {
    const novels = Array.from({ length: 25 }, (_, index) =>
      makeTestNovel(index + 1),
    );
    const v3Manifest = JSON.stringify({
      appVersion: '2.1.3',
      formatVersion: 3,
      novelDataFormat: 2,
      novelCount: 25,
      sections: options,
    });
    configureFiles(
      {
        'batch-000001.json': JSON.stringify(encodeNovelBatch(novels)),
      },
      v3Manifest,
    );
    const mappingsResult = createDeferred<RestoredNovelMapping[]>();
    const mappingsStarted = createDeferred<void>();
    jest.mocked(_restoreNovelsAndChapters).mockImplementation(() => {
      mappingsStarted.resolve(undefined);
      return mappingsResult.promise;
    });
    const progressTexts: string[] = [];
    const restorePromise = restoreData('/cache', (phase, _fraction, text) => {
      if (phase === 'novels') {
        progressTexts.push(text);
      }
    });
    await mappingsStarted.promise;
    expect(progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:0/25',
    );
    expect(progressTexts).not.toContain(
      'backupScreen.restoringNovelsProgress:25/25',
    );
    mappingsResult.resolve(makeMappings(novels));
    await restorePromise;

    expect(progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:25/25',
    );
  });

  it('uses the v2 novel file count before any mappings persist', async () => {
    const novels = [makeTestNovel(1), makeTestNovel(2), makeTestNovel(3)];
    const v2Manifest = JSON.stringify({
      appVersion: '2.1.3',
      formatVersion: 2,
      sections: options,
    });
    configureFiles(
      Object.fromEntries(
        novels.map(novel => [`novel-${novel.id}.json`, JSON.stringify(novel)]),
      ),
      v2Manifest,
    );
    jest
      .mocked(_restoreNovelsAndChapters)
      .mockImplementation(async batch => makeMappings(batch));
    const firstProgress = createDeferred<string>();
    const progressTexts: string[] = [];
    const restorePromise = restoreData('/cache', (phase, _fraction, text) => {
      if (phase !== 'novels') {
        return;
      }
      progressTexts.push(text);
      if (text.startsWith('backupScreen.restoringNovelsProgress:')) {
        firstProgress.resolve(text);
      }
    });

    await expect(firstProgress.promise).resolves.toBe(
      'backupScreen.restoringNovelsProgress:0/3',
    );
    const result = await restorePromise;

    expect(result.novelCount).toBe(3);
    expect(progressTexts).toContain('backupScreen.restoringNovelsProgress:3/3');
  });

  it('restores compact v2 batches using their total novel count', async () => {
    const firstBatch = Array.from({ length: 100 }, (_, index) =>
      makeTestNovel(index + 1),
    );
    const lastNovel = makeTestNovel(101);
    const v2Manifest = JSON.stringify({
      appVersion: '2.1.3',
      formatVersion: 2,
      novelDataFormat: 2,
      novelCount: 101,
      sections: options,
    });
    configureFiles(
      {
        'batch-000001.json': JSON.stringify(encodeNovelBatch(firstBatch)),
        'batch-000002.json': JSON.stringify(encodeNovelBatch([lastNovel])),
      },
      v2Manifest,
    );
    jest
      .mocked(_restoreNovelsAndChapters)
      .mockImplementation(async batch => makeMappings(batch));
    const capture = createProgressCapture();

    const result = await restoreData('/cache', capture.reporter);

    expect(result.novelCount).toBe(101);
    expect(capture.progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:0/101',
    );
    expect(capture.progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:101/101',
    );
  });

  it('restores successful novels after a failed three-novel batch', async () => {
    const novels = Array.from({ length: 3 }, (_, index) =>
      makeTestNovel(index + 1),
    );
    const v3Manifest = JSON.stringify({
      appVersion: '2.1.3',
      formatVersion: 3,
      novelDataFormat: 2,
      novelCount: 3,
      sections: options,
    });
    configureFiles(
      {
        'batch-000001.json': JSON.stringify(encodeNovelBatch(novels)),
      },
      v3Manifest,
    );
    jest
      .mocked(_restoreNovelsAndChapters)
      .mockRejectedValueOnce(new Error('batch restore failed'));
    jest.mocked(_restoreNovelAndChapters).mockImplementation(async novel => {
      if (novel.id === 2) {
        throw new Error('single novel restore failed');
      }
      return makeMappings([novel])[0];
    });
    const capture = createProgressCapture();

    const result = await restoreData('/cache', capture.reporter);

    expect(result.novelMappings).toEqual([
      makeMappings([novels[0]])[0],
      makeMappings([novels[2]])[0],
    ]);
    expect(result).toMatchObject({ novelCount: 2, failedNovelCount: 1 });
    expect(capture.progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:2/3',
    );
    expect(
      capture.progressValues.every(
        (value, index, values) => index === 0 || value >= values[index - 1],
      ),
    ).toBe(true);
    expect(capture.progressValues.every(value => value < 1)).toBe(true);
  });

  it('validates one later file during a 100-novel write', async () => {
    const firstFileNovels = Array.from({ length: 100 }, (_, index) =>
      makeTestNovel(index + 1),
    );
    const secondFileNovel = makeTestNovel(200);
    const duplicateNovel = makeTestNovel(201, secondFileNovel.path);
    const files = {
      'batch-000001.json': JSON.stringify(encodeNovelBatch(firstFileNovels)),
      'batch-000002.json': JSON.stringify(encodeNovelBatch([secondFileNovel])),
      'batch-000003.json': JSON.stringify(encodeNovelBatch([duplicateNovel])),
    };
    const v3Manifest = JSON.stringify({
      appVersion: '2.1.3',
      formatVersion: 3,
      novelDataFormat: 2,
      novelCount: 101,
      sections: options,
    });
    configureFiles(files, v3Manifest);
    const firstWrite = createDeferred<RestoredNovelMapping[]>();
    const secondFileRead = createDeferred<void>();
    const readFile = jest.mocked(NativeFile.readFile);
    const readFileImplementation = readFile.getMockImplementation()!;
    readFile.mockImplementation(async path => {
      if (path.endsWith('batch-000002.json')) {
        secondFileRead.resolve(undefined);
      }
      return readFileImplementation(path);
    });
    let writeCount = 0;
    jest
      .mocked(_restoreNovelsAndChapters)
      .mockImplementation(async (novels, restoreOptions) => {
        writeCount++;
        restoreOptions?.onProgress?.({
          stage: 'chapters',
          completed: 0,
          total: novels.length,
        });
        if (writeCount === 1) {
          return firstWrite.promise;
        }
        return makeMappings(novels);
      });
    const capture = createProgressCapture();

    const restorePromise = restoreData('/cache', capture.reporter);
    await secondFileRead.promise;

    expect(getNovelReadPaths()).toEqual([
      '/cache/NovelAndChapters/batch-000001.json',
      '/cache/NovelAndChapters/batch-000002.json',
    ]);
    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(_restoreNovelsAndChapters).toHaveBeenNthCalledWith(
      1,
      firstFileNovels,
      expect.objectContaining({
        includeChapterMappings: true,
        restoreRunId: expect.any(String),
      }),
    );
    expect(capture.progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:0/101',
    );
    expect(capture.progressTexts).not.toContain(
      'backupScreen.restoringNovelsProgress:100/101',
    );

    firstWrite.resolve(makeMappings(firstFileNovels));
    const result = await restorePromise;
    expect(capture.progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:100/101',
    );
    expect(capture.progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:101/101',
    );

    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(2);
    expect(_restoreNovelsAndChapters).toHaveBeenNthCalledWith(
      2,
      [secondFileNovel],
      expect.objectContaining({
        includeChapterMappings: true,
        restoreRunId: result.restoreRunId,
      }),
    );
    expect(getNovelReadPaths()).toEqual([
      '/cache/NovelAndChapters/batch-000001.json',
      '/cache/NovelAndChapters/batch-000002.json',
      '/cache/NovelAndChapters/batch-000003.json',
    ]);
    expect(result).toMatchObject({
      novelCount: 101,
      categoryCount: 1,
      failedNovelCount: 1,
      failedCategoryCount: 0,
      pluginIds: ['source'],
      novelMappings: [
        ...makeMappings(firstFileNovels),
        ...makeMappings([secondFileNovel]),
      ],
    });
    const [restoredCategory, restoredNovelIdMap] = (
      _restoreCategory as jest.Mock
    ).mock.calls[0];
    expect(restoredCategory).toEqual({
      id: 8,
      name: 'Reading list',
      novelIds: [1, 100, 200],
    });
    expect(restoredNovelIdMap.get(1)).toBe(10_001);
    expect(restoredNovelIdMap.get(100)).toBe(10_100);
    expect(restoredNovelIdMap.get(200)).toBe(10_200);
  });
  it('reports completion for empty and invalid files without novel writes', async () => {
    configureFiles({
      'empty.json': JSON.stringify(encodeNovelBatch([])),
      'invalid.json': '{',
    });
    const capture = createProgressCapture();
    const result = await restoreNovels(
      '/cache',
      {
        appVersion: '2.1.3',
        formatVersion: 2,
        novelDataFormat: 2,
        sections: options,
      },
      'restore-run',
      capture.reporter,
    );

    expect(_restoreNovelsAndChapters).not.toHaveBeenCalled();
    expect(capture.progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:0/1',
    );
    expect(result).toMatchObject({ novelCount: 0, failedNovelCount: 1 });
  });

  it('settles the active write when the progress updater throws undefined', async () => {
    const firstFileNovels = Array.from({ length: 100 }, (_, index) =>
      makeTestNovel(index + 1),
    );
    const nextFileNovel = makeTestNovel(200);
    const v3Manifest = JSON.stringify({
      appVersion: '2.1.3',
      formatVersion: 3,
      novelDataFormat: 2,
      novelCount: 101,
      sections: options,
    });
    configureFiles(
      {
        'batch-000001.json': JSON.stringify(encodeNovelBatch(firstFileNovels)),
        'batch-000002.json': JSON.stringify(encodeNovelBatch([nextFileNovel])),
      },
      v3Manifest,
    );
    const firstWrite = createDeferred<RestoredNovelMapping[]>();
    let firstWriteSettled = false;
    const writePromise = firstWrite.promise.then(mappings => {
      firstWriteSettled = true;
      return mappings;
    });
    jest
      .mocked(_restoreNovelsAndChapters)
      .mockImplementation(async (_batch, restoreOptions) => {
        restoreOptions?.onProgress?.({
          stage: 'chapters',
          completed: 0,
          total: 1,
        });
        return writePromise;
      });
    const secondFileRead = createDeferred<void>();
    const readFile = jest.mocked(NativeFile.readFile);
    const readFileImplementation = readFile.getMockImplementation()!;
    readFile.mockImplementation(async path => {
      if (path.endsWith('batch-000002.json')) {
        secondFileRead.resolve(undefined);
      }
      return readFileImplementation(path);
    });
    const interruption = undefined;
    const progressTexts: string[] = [];
    let metadata: BackgroundTaskMetadata = {
      name: 'LOCAL_RESTORE',
      isRunning: true,
      progress: undefined,
      progressText: undefined,
    };
    const setMeta: TaskProgressUpdater = transform => {
      metadata = transform(metadata);
      if (metadata.progressText) {
        progressTexts.push(metadata.progressText);
      }
      if (metadata.progress !== undefined && metadata.progress > 0.4) {
        throw interruption;
      }
    };

    const restorePromise = restoreData(
      '/cache',
      createRestoreProgressReporter(setMeta, 'local'),
    );
    await secondFileRead.promise;
    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
    expect(clearRestoreChapterMappings).not.toHaveBeenCalled();
    expect(progressTexts).toContain(
      'backupScreen.restoringNovelsProgress:0/101',
    );
    expect(progressTexts).not.toContain(
      'backupScreen.restoringNovelsProgress:100/101',
    );

    firstWrite.resolve(makeMappings(firstFileNovels));
    await expect(restorePromise).rejects.toBe(interruption);
    expect(progressTexts).not.toContain(
      'backupScreen.restoringNovelsProgress:100/101',
    );
    expect(_restoreNovelAndChapters).not.toHaveBeenCalled();

    expect(firstWriteSettled).toBe(true);
    expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
    expect(clearRestoreChapterMappings).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: 'Error', interruption: new Error('progress updater failed') },
    { label: 'undefined', interruption: undefined },
  ])(
    'does not start fallback after prefetched progress throws $label',
    async ({ interruption }) => {
      const firstFileNovels = Array.from({ length: 100 }, (_, index) =>
        makeTestNovel(index + 1),
      );
      const nextFileNovel = makeTestNovel(200);
      configureFiles({
        'batch-000001.json': JSON.stringify(encodeNovelBatch(firstFileNovels)),
        'batch-000002.json': JSON.stringify(encodeNovelBatch([nextFileNovel])),
      });

      const firstWrite = createDeferred<RestoredNovelMapping[]>();
      const databaseError = new Error('database batch failed');
      let firstWriteSettled = false;
      const writePromise = firstWrite.promise.then(
        mappings => {
          firstWriteSettled = true;
          return mappings;
        },
        error => {
          firstWriteSettled = true;
          throw error;
        },
      );
      jest
        .mocked(_restoreNovelsAndChapters)
        .mockImplementation(() => writePromise);
      jest
        .mocked(_restoreNovelAndChapters)
        .mockImplementation(async novel => makeMappings([novel])[0]);

      const secondFileRead = createDeferred<void>();
      const updaterInterrupted = createDeferred<void>();
      let currentTime = 1_000;
      const dateNow = jest
        .spyOn(Date, 'now')
        .mockImplementation(() => currentTime);
      let metadata: BackgroundTaskMetadata = {
        name: 'LOCAL_RESTORE',
        isRunning: true,
        progress: undefined,
        progressText: undefined,
      };
      let interruptionThrown = false;
      const setMeta: TaskProgressUpdater = transform => {
        metadata = transform(metadata);
        if (
          !interruptionThrown &&
          metadata.progress !== undefined &&
          metadata.progress > 0.4
        ) {
          interruptionThrown = true;
          updaterInterrupted.resolve(undefined);
          throw interruption;
        }
      };
      const readFile = jest.mocked(NativeFile.readFile);
      const readFileImplementation = readFile.getMockImplementation()!;
      readFile.mockImplementation(async path => {
        if (path.endsWith('batch-000002.json')) {
          currentTime += 250;
          secondFileRead.resolve(undefined);
        }
        return readFileImplementation(path);
      });
      jest.mocked(clearRestoreChapterMappings).mockImplementation(async () => {
        expect(firstWriteSettled).toBe(true);
      });

      try {
        const restorePromise = restoreData(
          '/cache',
          createRestoreProgressReporter(setMeta, 'local'),
        );
        await secondFileRead.promise;
        await updaterInterrupted.promise;

        expect(_restoreNovelsAndChapters).toHaveBeenCalledTimes(1);
        expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
        expect(clearRestoreChapterMappings).not.toHaveBeenCalled();

        firstWrite.reject(databaseError);
        await expect(restorePromise).rejects.toBe(interruption);

        expect(firstWriteSettled).toBe(true);
        expect(_restoreNovelAndChapters).not.toHaveBeenCalled();
        expect(clearRestoreChapterMappings).toHaveBeenCalledTimes(1);
      } finally {
        dateNow.mockRestore();
      }
    },
  );
});
