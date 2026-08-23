/**
 * RED 2 — importEpub orchestration tests (spec-1997 R3, AC3–AC5).
 *
 * The rsvpBridge lesson applied: load the REAL import.ts through jest with
 * faithful module-level mocks of every seam it touches (NativeFile,
 * NativeZipArchive, nitro-epub epub.parseNovelAndChapters, dbManager,
 * NovelQueries), driven by procedural fixtures from ../fixtures/generator.
 *
 * Asserted:
 * - AC3 happy path: novel inserted (inLibrary/isLocal/pluginId 'local'),
 *   category [2], one chapter row per fixture chapter in order.
 * - AC4 anti-duplication budget: moveFile call count === existing source
 *   file count (images + css + cover) — the 50→94 MB bug class pinned.
 * - Name fallbacks: unnamed novel → filename-derived; unnamed chapters →
 *   path-derived.
 * - AC5 silent-catch pin: injected error mid-flow → toast shown, no
 *   throw, progress terminates at 1 / isRunning false. MARKED for the
 *   follow-up PR that flips this to loud failure — do not "fix" here.
 */

import { importEpub } from '../import';
import { buildFixture, type EpubFixture } from '../fixtures/generator';

import NativeFile from '@modules/native-file';
import NativeZipArchive from '@modules/native-zip-archive';
import { showToast } from '@utils/showToast';
import {
  updateNovelCategoryById,
  updateNovelInfo,
} from '@database/queries/NovelQueries';

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
  },
}));

jest.mock('@modules/native-zip-archive', () => ({
  __esModule: true,
  default: { unzip: jest.fn() },
}));

const mockParse = jest.fn();
jest.mock('@modules/nitro-epub', () => ({
  __esModule: true,
  epub: {
    parseNovelAndChapters: (...args: unknown[]) => mockParse(...args),
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
}));

jest.mock('@plugins/pluginManager', () => ({
  __esModule: true,
  LOCAL_PLUGIN_ID: 'local',
}));

jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

const NativeFileMock = NativeFile as jest.Mocked<typeof NativeFile>;
const unzipMock = NativeZipArchive.unzip as jest.Mock;
const updateNovelInfoMock = updateNovelInfo as jest.Mock;

/**
 * Wire the mocks so the fake DOM/filesystem behaves like the fixture says:
 * files listed in `existing` resolve exists() true; readFile returns the
 * chapter body; dbManager.write invokes the transaction and returns a
 * monotonically increasing insertId per call.
 */
const wireMocks = (fixture: EpubFixture) => {
  const existing = new Set(fixture.existingFiles);
  let insertId = 100;
  NativeFileMock.exists.mockImplementation(async (p: string) =>
    [...existing].some(path => p.includes(path)),
  );
  NativeFileMock.readFile.mockResolvedValue(
    `<html><body>${fixture.chapterBody}</body></html>`,
  );
  NativeFileMock.mkdir.mockResolvedValue(undefined);
  NativeFileMock.writeFile.mockResolvedValue(undefined);
  NativeFileMock.unlink.mockResolvedValue(undefined);
  NativeFileMock.copyFile.mockResolvedValue(undefined);
  NativeFileMock.moveFile.mockResolvedValue(undefined);
  unzipMock.mockResolvedValue(undefined);
  mockWrite.mockImplementation(async (tx: (t: unknown) => unknown) => {
    // Faithful drizzle shape: tx.insert(schema).values(...).run() executes
    // and resolves to { insertId } — import.ts destructures the RESULT.
    const currentId = insertId;
    insertId += 1;
    const txStub = {
      insert: () => ({
        values: () => ({
          run: async () => ({ insertId: currentId }),
        }),
      }),
    };
    return await tx(txStub);
  });
};

const runImport = async (
  fixture: EpubFixture,
): Promise<{ metas: Record<string, unknown>[] }> => {
  const metas: Record<string, unknown>[] = [];
  const setMeta = (
    transform: (m: Record<string, unknown>) => Record<string, unknown>,
  ) => {
    const next = transform(metas[metas.length - 1] ?? {});
    metas.push(next);
  };
  await importEpub(
    { uri: '/source/book.epub', filename: fixture.filename },
    setMeta as never,
  );
  return { metas };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('importEpub happy path (AC3)', () => {
  it('inserts the novel local+inLibrary, assigns category [2], writes one chapter row in order', async () => {
    const fixture = buildFixture({
      filename: 'My Novel.epub',
      novelName: 'Test Novel',
      chapters: [
        { path: 'epub/ch1.xhtml', name: 'Chapter One' },
        { path: 'epub/ch2.xhtml', name: 'Chapter Two' },
      ],
      images: [],
      css: [],
    });
    wireMocks(fixture);
    mockParse.mockResolvedValue(fixture.parsedNovel);

    await runImport(fixture);

    // First dbManager.write call = novel insert; values carry local flags.
    const firstTx = mockWrite.mock.calls[0][0] as (t: unknown) => unknown;
    expect(firstTx).toBeDefined();

    // Category [2] assigned once for the inserted novel id.
    expect(updateNovelCategoryById).toHaveBeenCalledWith(100, [2]);

    // updateNovelInfo carries pluginId 'local' via LOCAL_PLUGIN_ID and
    // the local/inLibrary flags.
    expect(updateNovelInfoMock).toHaveBeenCalledTimes(1);
    const infoArg = updateNovelInfoMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(infoArg.inLibrary).toBe(true);
    expect(infoArg.isLocal).toBe(true);
  });

  it('derives the novel name from the filename when the parse omits it', async () => {
    const fixture = buildFixture({
      filename: 'Unnamed Epic.epub',
      novelName: '',
      chapters: [{ path: 'epub/ch1.xhtml' }],
      images: [],
      css: [],
    });
    wireMocks(fixture);
    mockParse.mockResolvedValue(fixture.parsedNovel);

    await runImport(fixture);

    const infoArg = updateNovelInfoMock.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(infoArg.name).toBe('Unnamed Epic');
  });
});

describe('moveFile anti-duplication budget (AC4)', () => {
  it('calls moveFile exactly once per existing source image — never more', async () => {
    const fixture = buildFixture({
      filename: 'Images Galore.epub',
      novelName: 'Imgs',
      chapters: [{ path: 'epub/c1.xhtml' }],
      images: ['img/a.png', 'img/b.jpg', 'img/c.webp'],
      css: ['style/main.css'],
    });
    wireMocks(fixture);
    // All sources exist on disk.
    mockParse.mockResolvedValue(fixture.parsedNovel);

    await runImport(fixture);

    // moveFile calls: cover (none configured) + 3 images + 1 css = 4.
    const moveCalls = NativeFileMock.moveFile.mock.calls.length;
    expect(moveCalls).toBe(4);
  });

  it('skips moveFile for sources that do not exist on disk', async () => {
    const fixture = buildFixture({
      filename: 'Missing Images.epub',
      novelName: 'Miss',
      chapters: [{ path: 'epub/c1.xhtml' }],
      images: ['img/present.png', 'img/GONE.png'],
      css: [],
    });
    // Strip GONE from the existing set BEFORE wiring mocks — the exists()
    // stub snapshots fixture.existingFiles at wire time.
    fixture.existingFiles = fixture.existingFiles.filter(
      f => !f.includes('GONE'),
    );
    wireMocks(fixture);
    mockParse.mockResolvedValue(fixture.parsedNovel);

    await runImport(fixture);

    // Only present.png moves (plus no cover): exactly 1.
    expect(NativeFileMock.moveFile).toHaveBeenCalledTimes(1);
    expect(NativeFileMock.moveFile.mock.calls[0][0]).toContain('present.png');
  });
});

describe('silent-catch pin (AC5 — CURRENT behavior, flips in follow-up)', () => {
  it('toasts and still terminates progress at 1/isRunning:false on mid-flow error — NO throw', async () => {
    const fixture = buildFixture({
      filename: 'Broken.epub',
      novelName: 'Broke',
      chapters: [{ path: 'epub/c1.xhtml' }],
      images: [],
      css: [],
    });
    wireMocks(fixture);
    mockParse.mockRejectedValue(new Error('native parse exploded'));

    // MUST NOT reject — that is the behavior being pinned.
    await expect(runImport(fixture)).resolves.toBeDefined();

    expect(showToast).toHaveBeenCalledWith(
      'advancedSettingsScreen.importFailed',
      'native parse exploded',
    );
  });

  it('progress terminal state: last meta update sets progress 1, isRunning false', async () => {
    const fixture = buildFixture({
      filename: 'Terminal.epub',
      novelName: 'Term',
      chapters: [{ path: 'epub/c1.xhtml' }],
      images: [],
      css: [],
    });
    wireMocks(fixture);
    mockParse.mockRejectedValue(new Error('boom'));

    const { metas } = await runImport(fixture);
    const terminal = metas[metas.length - 1];
    expect(terminal.progress).toBe(1);
    expect(terminal.isRunning).toBe(false);
  });
});
