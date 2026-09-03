/**
 * Slice 1 RED — port interface tests (spec-arch-epub-port AC3, AC5).
 *
 * The port is a DEEP MODULE: import/export behavior behind two functions.
 * Tests cross only the interface — module-level fakes of the native seams
 * (NativeFile / NativeZipArchive / nitro-epub / dbManager) are the second
 * real adapter per DEEPENING.md seam discipline.
 *
 * Covers: happy path × both ops, all five error kinds × both ops where
 * reachable, progress phase sequence assertions, and the #1997
 * operation-count budgets carried in as behavior parity (AC5).
 *
 * RED: ../port does not exist yet — documented before implementation.
 */

import { importNovel, exportNovel } from '../port';
import { buildFixture } from '../fixtures/generator';
import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { updateNovelCategoryById } from '@database/queries/NovelQueries';

// Captured insert values let tests assert library flags on real rows.
const capturedInsertValues: Record<string, unknown>[] = [];

jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: {
    ExternalCachesDirectoryPath: '/caches',
    exists: jest.fn(),
    mkdir: jest.fn(),
    unlink: jest.fn(),
    copyFile: jest.fn(),
    moveFile: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    copyFileToDirectory: jest.fn(),
  },
}));

jest.mock('@modules/native-zip-archive', () => ({
  __esModule: true,
  default: { unzip: jest.fn() },
}));

const mockParse = jest.fn();
const mockExport = jest.fn();
jest.mock('@modules/nitro-epub', () => ({
  __esModule: true,
  epub: {
    parseNovelAndChapters: (...args: unknown[]) => mockParse(...args),
    exportEpub: (...args: unknown[]) => mockExport(...args),
  },
}));

const mockWrite = jest.fn();
const mockGetSync = jest.fn();
jest.mock('@database/db', () => ({
  __esModule: true,
  dbManager: {
    write: (fn: unknown) => mockWrite(fn),
    getSync: (...args: unknown[]) => mockGetSync(...args),
    select: () => ({ from: () => ({ where: () => undefined }) }),
  },
}));

jest.mock('@plugins/pluginManager', () => ({
  __esModule: true,
  LOCAL_PLUGIN_ID: 'local',
}));

const mockGetDownloaded = jest.fn();
const mockGetNovelById = jest.fn();
jest.mock('@database/queries/ChapterQueries', () => ({
  __esModule: true,
  getNovelDownloadedChapters: (...args: unknown[]) =>
    mockGetDownloaded(...args),
}));
jest.mock('@database/queries/NovelQueries', () => ({
  __esModule: true,
  updateNovelCategoryById: jest.fn(),
  updateNovelInfo: jest.fn(),
  getNovelById: (...args: unknown[]) => mockGetNovelById(...args),
}));

const NativeFileMock = NativeFile as jest.Mocked<typeof NativeFile>;
const unzipMock = NativeZipArchive.unzip as jest.Mock;

const wireHappyFilesystem = (
  fixture: ReturnType<typeof buildFixture>,
  opts: { sourceUri?: string } = {},
) => {
  const existing = new Set(fixture.existingFiles);
  if (opts.sourceUri) existing.add(opts.sourceUri);
  let insertId = 100;
  NativeFileMock.exists.mockImplementation(async (p: string) =>
    [...existing].some(path => p.includes(path)),
  );
  NativeFileMock.readFile.mockResolvedValue('<p>body</p>');
  NativeFileMock.mkdir.mockResolvedValue(undefined);
  NativeFileMock.writeFile.mockResolvedValue(undefined);
  NativeFileMock.unlink.mockResolvedValue(undefined);
  NativeFileMock.copyFile.mockResolvedValue(undefined);
  NativeFileMock.moveFile.mockResolvedValue(undefined);
  (NativeFileMock.copyFileToDirectory as jest.Mock).mockResolvedValue({
    size: 1024,
  });
  mockWrite.mockImplementation(async (tx: (t: unknown) => unknown) => {
    const currentId = insertId;
    insertId += 1;
    return await tx({
      insert: () => ({
        values: (v: Record<string, unknown>) => {
          capturedInsertValues.push(v);
          return {
            run: async () => ({ insertId: currentId }),
          };
        },
      }),
    });
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('importNovel — interface (AC3 happy + phases)', () => {
  it('returns ok with novelId/name/chapterCount and runs the phase sequence', async () => {
    const fixture = buildFixture({
      filename: 'My Novel.epub',
      novelName: 'Ported Novel',
      chapters: [
        { path: 'epub/ch1.xhtml', name: 'One' },
        { path: 'epub/ch2.xhtml', name: 'Two' },
      ],
      images: ['img/a.png'],
      css: [],
    });
    wireHappyFilesystem(fixture, { sourceUri: '/source/book.epub' });
    mockParse.mockResolvedValue(fixture.parsedNovel);

    const phases: string[] = [];
    const result = await importNovel(
      { uri: '/source/book.epub', filename: fixture.filename },
      p => phases.push(p.phase),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.value.novelId).toBe(100);
    expect(result.value.name).toBe('Ported Novel');
    expect(result.value.chapterCount).toBe(2);

    // Phases appear in contractual order; later phases may repeat per item.
    expect(phases[0]).toBe('copy');
    expect(phases).toContain('extract');
    expect(phases).toContain('parse');
    expect(phases).toContain('db');
    expect(phases.indexOf('images')).toBeGreaterThan(phases.indexOf('parse'));

    // CASES.md claims backed by real assertions.
    expect(updateNovelCategoryById).toHaveBeenCalledWith(100, [2]);
    const novelInsert = capturedInsertValues.find(v => 'inLibrary' in v);
    expect(novelInsert?.inLibrary).toBe(true);
    expect(novelInsert?.isLocal).toBe(true);
  });

  it('zip-corrupt: unzip rejection maps to { kind: zip-corrupt }', async () => {
    const fixture = buildFixture({
      filename: 'Corrupt.epub',
      novelName: 'X',
      chapters: [],
      images: [],
      css: [],
    });
    wireHappyFilesystem(fixture, { sourceUri: '/source/bad.epub' });
    unzipMock.mockRejectedValue(new Error('bad zip'));

    const result = await importNovel(
      { uri: '/source/bad.epub', filename: fixture.filename },
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected errors');
    expect(result.errors[0]).toEqual({
      kind: 'zip-corrupt',
      path: '/caches/novel.epub',
    });
  });

  it('file-not-found: missing source uri maps to { kind: file-not-found }', async () => {
    NativeFileMock.exists.mockResolvedValue(false);

    const result = await importNovel(
      { uri: '/source/GONE.epub', filename: 'gone.epub' },
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected errors');
    expect(result.errors[0]).toEqual({
      kind: 'file-not-found',
      path: '/source/GONE.epub',
    });
  });

  it('parse-failure: parse rejection maps to { kind: parse-failure }', async () => {
    const fixture = buildFixture({
      filename: 'ParseFail.epub',
      novelName: 'X',
      chapters: [],
      images: [],
      css: [],
    });
    wireHappyFilesystem(fixture, { sourceUri: '/source/p.epub' });
    unzipMock.mockResolvedValue(undefined);
    mockParse.mockRejectedValue(new Error('structure nonsense'));

    const result = await importNovel(
      { uri: '/source/p.epub', filename: fixture.filename },
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected errors');
    expect(result.errors[0].kind).toBe('parse-failure');
    expect((result.errors[0] as { message?: string }).message).toBe(
      'structure nonsense',
    );
  });

  it('image-move-partial: failed moves are collected, not silently dropped', async () => {
    const fixture = buildFixture({
      filename: 'Partial.epub',
      novelName: 'P',
      chapters: [{ path: 'epub/c1.xhtml' }],
      images: ['img/moves.png', 'img/fails.png'],
      css: [],
    });
    wireHappyFilesystem(fixture, { sourceUri: '/s/b.epub' });
    unzipMock.mockResolvedValue(undefined);
    mockParse.mockResolvedValue(fixture.parsedNovel);
    NativeFileMock.moveFile.mockImplementation(async (from: string) => {
      if (from.includes('fails.png')) {
        throw new Error('EACCES');
      }
    });

    const result = await importNovel(
      { uri: '/s/b.epub', filename: fixture.filename },
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected errors');
    const partial = result.errors.find(e => e.kind === 'image-move-partial');
    expect(partial).toBeDefined();
    if (partial?.kind !== 'image-move-partial') throw new Error('bad kind');
    expect(partial.moved).toEqual(['img/moves.png']);
    expect(partial.failed).toEqual(['img/fails.png']);
  });

  it('moveFile budget: exactly one call per existing source, zero for missing (#1997 parity)', async () => {
    const fixture = buildFixture({
      filename: 'Budget.epub',
      novelName: 'B',
      chapters: [{ path: 'epub/c1.xhtml' }],
      images: ['img/a.png', 'img/b.jpg', 'img/GONE.png'],
      css: ['style/main.css'],
    });
    // GONE does not exist on disk; a.png/b.jpg/css do.
    fixture.existingFiles = fixture.existingFiles.filter(
      f => !f.includes('GONE'),
    );
    wireHappyFilesystem(fixture, { sourceUri: '/s/b.epub' });
    unzipMock.mockResolvedValue(undefined);
    mockParse.mockResolvedValue(fixture.parsedNovel);

    const result = await importNovel(
      { uri: '/s/b.epub', filename: fixture.filename },
      undefined,
    );

    // Missing sources are a skip per ruling 83857ea: the import succeeds
    // and the skip is visible as data. The budget below is the actual
    // regression guard.
    expect(result.ok).toBe(true);
    // Ruling 83857ea: the skip is visible as data, not silent.
    if (!result.ok) throw new Error('expected ok');
    const skippedWarning = result.warnings?.find(
      w => w.kind === 'image-move-skipped',
    );
    expect(skippedWarning).toBeDefined();
    expect(skippedWarning?.paths).toEqual(['img/GONE.png']);
    // 2 existing images + 1 existing css = exactly 3 moves. The 50 MB to
    // 94 MB duplication bug class fails loudly if the port ever copies
    // twice or moves missing sources.
    expect(NativeFileMock.moveFile.mock.calls.length).toBe(3);
    const movedPaths = NativeFileMock.moveFile.mock.calls.map(
      (call: unknown[]) => String(call[0]),
    );
    expect(movedPaths.filter(p => p.includes('a.png')).length).toBe(1);
    expect(movedPaths.filter(p => p.includes('b.jpg')).length).toBe(1);
    expect(movedPaths.some(p => p.includes('main.css'))).toBe(true);
    expect(movedPaths.some(p => p.includes('GONE'))).toBe(false);
  });

  it('db-write-failure: novel-stage insert error maps to stage novel', async () => {
    const fixture = buildFixture({
      filename: 'DbFail.epub',
      novelName: 'D',
      chapters: [{ path: 'epub/c1.xhtml' }],
      images: [],
      css: [],
    });
    wireHappyFilesystem(fixture, { sourceUri: '/s/b.epub' });
    unzipMock.mockResolvedValue(undefined);
    mockParse.mockResolvedValue(fixture.parsedNovel);
    mockWrite.mockRejectedValue(new Error('disk full'));

    const result = await importNovel(
      { uri: '/s/b.epub', filename: fixture.filename },
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected errors');
    expect(result.errors[0]).toEqual({
      kind: 'db-write-failure',
      stage: 'novel',
    });
  });
});

describe('exportNovel — interface (AC3 happy + phases)', () => {
  beforeEach(() => {
    // Both export tests need the chapters query to succeed with content;
    // exportNovel reads chapters through the port's own seam.
    mockGetDownloaded.mockResolvedValue([
      {
        id: 1,
        novelId: 42,
        pluginId: 'local',
        name: 'Chapter One',
        isDownloaded: true,
      },
    ] as never);
  });

  it('returns ok with the output uri and runs the phase flow', async () => {
    mockGetDownloaded.mockResolvedValue([
      {
        id: 7,
        novelId: 42,
        name: 'Chapter One',
        pluginId: 'local',
        isDownloaded: true,
      },
    ]);
    mockExport.mockResolvedValue({
      outputPath: '/caches/out.epub',
      chapterCount: 1,
    });

    const phases: string[] = [];
    const result = await exportNovel(
      42,
      {
        destinationUri: '/dest/',
        filenameOverride: 'My Book',
        applyReaderTheme: true,
        includeCustomJs: false,
      },
      p => phases.push(p.phase),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected ok, got: ' + JSON.stringify(result.errors));
    }
    expect(result.value.uri).toContain('My Book.epub');
    expect(phases[0]).toBe('db');
    expect(phases).toContain('parse');
    expect(phases).toContain('copy');
  });

  it('maps export failure to parse-failure kind with message', async () => {
    // The chapters query succeeds; only the native export fails.
    mockGetDownloaded.mockResolvedValue([
      {
        id: 7,
        novelId: 42,
        name: 'Chapter One',
        pluginId: 'local',
        isDownloaded: true,
      },
    ]);
    mockExport.mockRejectedValue(new Error('chapter html vanished'));

    const result = await exportNovel(
      42,
      {
        destinationUri: '/dest/',
        filenameOverride: 'B',
        applyReaderTheme: false,
        includeCustomJs: false,
      },
      undefined,
    );

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected errors');
    expect(result.errors[0].kind).toBe('parse-failure');
    expect((result.errors[0] as { message?: string }).message).toBe(
      'chapter html vanished',
    );
  });

  it('builds export metadata from the novel row (no hardcoded fallback)', async () => {
    // getNovelById resolves synchronously from the DB layer.
    mockGetNovelById.mockReturnValue({
      id: 42,
      name: 'Real Novel Title',
      cover: '/covers/42.jpg',
      author: 'Real Author',
      summary: 'A real summary',
      pluginId: 'someplugin',
    });
    mockGetDownloaded.mockResolvedValue([
      {
        id: 7,
        novelId: 42,
        name: 'Chapter One',
        pluginId: 'someplugin',
        isDownloaded: true,
      },
    ]);
    mockExport.mockResolvedValue({
      outputPath: '/caches/out.epub',
      chapterCount: 1,
    });

    await exportNovel(
      42,
      {
        destinationUri: '/dest/',
        applyReaderTheme: false,
        includeCustomJs: false,
      },
      undefined,
    );

    const metadata = mockExport.mock.calls[0][0];
    expect(metadata.title).toBe('Real Novel Title');
    expect(metadata.coverPath).toBe('/covers/42.jpg');
    expect(metadata.author).toBe('Real Author');
    expect(metadata.description).toBe('A real summary');
    expect(metadata.bookId).toBe('urn:lnreader:someplugin:42');
  });

  it('falls back to derived metadata when the novel row is missing', async () => {
    mockGetNovelById.mockReturnValue(undefined);
    mockGetDownloaded.mockResolvedValue([
      {
        id: 7,
        novelId: 42,
        name: 'Chapter One',
        pluginId: 'local',
        isDownloaded: true,
      },
    ]);
    mockExport.mockResolvedValue({
      outputPath: '/caches/out.epub',
      chapterCount: 1,
    });

    await exportNovel(
      42,
      {
        destinationUri: '/dest/',
        applyReaderTheme: false,
        includeCustomJs: false,
      },
      undefined,
    );

    const metadata = mockExport.mock.calls[0][0];
    expect(metadata.title).toBe('novel-42');
    expect(metadata.bookId).toBe('urn:lnreader:local:42');
  });
});
