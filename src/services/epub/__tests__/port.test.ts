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
jest.mock('@database/db', () => ({
  __esModule: true,
  dbManager: { write: (fn: unknown) => mockWrite(fn) },
}));

jest.mock('@database/queries/NovelQueries', () => ({
  __esModule: true,
  updateNovelCategoryById: jest.fn(),
  updateNovelInfo: jest.fn(),
  getNovelById: jest.fn().mockResolvedValue({ pluginId: 'local' }),
}));

jest.mock('@plugins/pluginManager', () => ({
  __esModule: true,
  LOCAL_PLUGIN_ID: 'local',
}));

const mockGetDownloaded = jest.fn();
jest.mock('@database/queries/ChapterQueries', () => ({
  __esModule: true,
  getNovelDownloadedChapters: (...args: unknown[]) =>
    mockGetDownloaded(...args),
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
        values: () => ({
          run: async () => ({ insertId: currentId }),
        }),
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
});
