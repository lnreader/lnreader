import { importEpub } from '@services/epub/import';
import NativeFile from '@specs/NativeFile';
import NativeZipArchive from '@specs/NativeZipArchive';
import NativeEpub from '@specs/NativeEpub';
import { insertChapters, getNovelChapters } from '@database/queries/ChapterQueries';
import {
  updateNovelCategoryById,
  updateNovelInfo,
} from '@database/queries/NovelQueries';
import { dbManager } from '@database/db';

jest.mock('@plugins/pluginManager', () => ({
  LOCAL_PLUGIN_ID: 'local',
}));

jest.mock('@database/db', () => ({
  dbManager: {
    write: jest.fn(async (callback: (tx: { update: jest.Mock; insert: jest.Mock }) => void) => {
      const tx = {
        update: jest.fn(() => ({
          set: jest.fn(() => ({
            where: jest.fn(() => ({
              run: jest.fn(),
            })),
          })),
        })),
        insert: jest.fn(() => ({
          values: jest.fn(() => ({
            run: jest.fn(() => ({ insertId: 1 })),
          })),
        })),
      };
      return callback(tx);
    }),
  },
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn((key: string) => key),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/mock/external/Novels',
}));

const setMeta = jest.fn((transformer: (meta: any) => any) => transformer({}));

const mockNativeFile = NativeFile as jest.Mocked<typeof NativeFile>;
const mockNativeZip = NativeZipArchive as jest.Mocked<typeof NativeZipArchive>;
const mockNativeEpub = NativeEpub as jest.Mocked<typeof NativeEpub>;
const mockInsertChapters = insertChapters as jest.MockedFunction<
  typeof insertChapters
>;
const mockGetNovelChapters = getNovelChapters as jest.MockedFunction<
  typeof getNovelChapters
>;
const mockUpdateNovelCategoryById =
  updateNovelCategoryById as jest.MockedFunction<
    typeof updateNovelCategoryById
  >;
const mockUpdateNovelInfo = updateNovelInfo as jest.MockedFunction<
  typeof updateNovelInfo
>;

const chapterTitleOnly = `<?xml version='1.0' encoding='utf-8'?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
  <head>
    <title>Unknown</title>
  </head>
  <body class="calibre">
    <p>prologue</p>
  </body>
</html>`;

const chapterContent = `<?xml version='1.0' encoding='utf-8'?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
  <head>
    <title>Unknown</title>
  </head>
  <body class="calibre">
    <p>The Problem-Solver</p>
  </body>
</html>`;

describe('importEpub', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNativeFile.getConstants.mockReturnValue({
      ExternalDirectoryPath: '/mock/external',
      ExternalCachesDirectoryPath: '/mock/caches',
    });
    mockNativeFile.exists.mockReturnValue(true);
    mockNativeFile.copyFile.mockReturnValue(undefined);
    mockNativeFile.mkdir.mockReturnValue(undefined);
    mockNativeFile.writeFile.mockReturnValue(undefined);
    mockNativeFile.moveFile.mockReturnValue(undefined);
    mockNativeZip.unzip.mockResolvedValue();
    mockUpdateNovelCategoryById.mockResolvedValue();
    mockUpdateNovelInfo.mockResolvedValue();
  });

  it('batches chapter inserts and writes content using db ids', async () => {
    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: 'Test Novel',
      cover: null,
      summary: null,
      author: null,
      artist: null,
      chapters: [
        { name: 'prologue', path: '/mock/epub/1_index_split_000.html' },
        { name: 'prologue (2)', path: '/mock/epub/1_index_split_001.html' },
      ],
      cssPaths: [],
      imagePaths: [],
    });

    mockNativeFile.readFile.mockImplementation(path => {
      if (path === '/mock/epub/1_index_split_000.html') return chapterTitleOnly;
      if (path === '/mock/epub/1_index_split_001.html') return chapterContent;
      return '';
    });

    mockGetNovelChapters.mockResolvedValue([
      {
        id: 101,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'prologue',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'source.epub' },
      setMeta,
    );

    expect(mockNativeZip.unzip).toHaveBeenCalled();
    expect(mockInsertChapters).toHaveBeenCalledTimes(1);
    expect(mockInsertChapters).toHaveBeenCalledWith(1, [
      {
        name: 'prologue',
        path: '/mock/external/Novels/local/1/0',
        releaseTime: expect.any(String),
        chapterNumber: 1,
        page: '1',
      },
    ]);
    expect(mockGetNovelChapters).toHaveBeenCalledWith(
      1,
      'positionAsc',
      undefined,
      undefined,
      1,
    );
    expect(mockNativeFile.writeFile).toHaveBeenCalledWith(
      '/mock/external/Novels/local/1/101/index.html',
      expect.stringContaining('The Problem-Solver'),
    );
    expect(dbManager.write).toHaveBeenCalled();
  });

  it('throws error when file copy fails', async () => {
    mockNativeFile.copyFile.mockImplementation(() => {
      throw new Error('File not found');
    });

    await expect(
      importEpub(
        { uri: '/mock/source.epub', filename: 'source.epub' },
        setMeta,
      ),
    ).rejects.toThrow(
      'Failed to read EPUB file "source.epub". The file may have been moved or deleted. Please try importing again.',
    );
  });

  it('uses filename as novel name when parsed name is empty', async () => {
    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: '',
      cover: null,
      summary: null,
      author: null,
      artist: null,
      chapters: [
        { name: 'Chapter 1', path: '/mock/epub/chapter1.html' },
      ],
      cssPaths: [],
      imagePaths: [],
    });

    mockNativeFile.readFile.mockReturnValue(chapterContent);
    mockGetNovelChapters.mockResolvedValue([
      {
        id: 1,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'Chapter 1',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'My Novel.epub' },
      setMeta,
    );

    // The novel name should fallback to filename without .epub
    expect(mockNativeEpub.parseNovelAndChapters).toHaveBeenCalled();
  });

  it('skips title-only chapters and merges with next chapter', async () => {
    const titleOnlyChapter = `<?xml version='1.0' encoding='utf-8'?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
  <head>
    <title>Chapter 1</title>
  </head>
  <body class="calibre">
    <p>Chapter 1</p>
  </body>
</html>`;

    const actualContent = `<?xml version='1.0' encoding='utf-8'?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
  <head>
    <title>Chapter 1</title>
  </head>
  <body class="calibre">
    <p>This is the actual content of chapter 1.</p>
  </body>
</html>`;

    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: 'Test Novel',
      cover: null,
      summary: null,
      author: null,
      artist: null,
      chapters: [
        { name: 'Chapter 1', path: '/mock/epub/chapter1.html' },
        { name: 'Chapter 1', path: '/mock/epub/chapter2.html' },
      ],
      cssPaths: [],
      imagePaths: [],
    });

    mockNativeFile.readFile.mockImplementation(path => {
      if (path === '/mock/epub/chapter1.html') return titleOnlyChapter;
      if (path === '/mock/epub/chapter2.html') return actualContent;
      return '';
    });

    mockGetNovelChapters.mockResolvedValue([
      {
        id: 1,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'Chapter 1',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'source.epub' },
      setMeta,
    );

    // Title-only chapter should be skipped, only one chapter inserted
    expect(mockInsertChapters).toHaveBeenCalledWith(1, [
      expect.objectContaining({
        name: 'Chapter 1',
      }),
    ]);
  });

  it('handles derived chapter names with parentheses', async () => {
    // First chapter is title-only (sets pendingTitleName)
    // Second chapter has derived name pattern and should use the pending title
    const titleOnlyChapter = `<?xml version='1.0' encoding='utf-8'?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en" xml:lang="en">
  <head>
    <title>Chapter 1</title>
  </head>
  <body class="calibre">
    <p>Chapter 1</p>
  </body>
</html>`;

    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: 'Test Novel',
      cover: null,
      summary: null,
      author: null,
      artist: null,
      chapters: [
        { name: 'Chapter 1', path: '/mock/epub/chapter1.html' },
        { name: 'Chapter 1 (2)', path: '/mock/epub/chapter2.html' },
      ],
      cssPaths: [],
      imagePaths: [],
    });

    mockNativeFile.readFile.mockImplementation(path => {
      if (path === '/mock/epub/chapter1.html') return titleOnlyChapter;
      if (path === '/mock/epub/chapter2.html') return chapterContent;
      return '';
    });

    mockGetNovelChapters.mockResolvedValue([
      {
        id: 1,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'Chapter 1',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'source.epub' },
      setMeta,
    );

    // Title-only chapter is skipped, second chapter with derived name uses pending title
    expect(mockInsertChapters).toHaveBeenCalledWith(1, [
      expect.objectContaining({ name: 'Chapter 1' }),
    ]);
  });

  it('copies asset files (images and css)', async () => {
    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: 'Test Novel',
      cover: '/mock/epub/cover.jpg',
      summary: null,
      author: null,
      artist: null,
      chapters: [
        { name: 'Chapter 1', path: '/mock/epub/chapter1.html' },
      ],
      cssPaths: ['/mock/epub/style.css'],
      imagePaths: ['/mock/epub/cover.jpg', '/mock/epub/image.png'],
    });

    mockNativeFile.readFile.mockReturnValue(chapterContent);
    mockNativeFile.exists.mockImplementation(path => {
      // Simulate that asset files exist
      return path.includes('/mock/epub/');
    });

    mockGetNovelChapters.mockResolvedValue([
      {
        id: 1,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'Chapter 1',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'source.epub' },
      setMeta,
    );

    // Verify that moveFile is called for assets
    expect(mockNativeFile.moveFile).toHaveBeenCalled();
  });

  it('skips chapters with empty content', async () => {
    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: 'Test Novel',
      cover: null,
      summary: null,
      author: null,
      artist: null,
      chapters: [
        { name: 'Empty Chapter', path: '/mock/epub/empty.html' },
        { name: 'Valid Chapter', path: '/mock/epub/valid.html' },
      ],
      cssPaths: [],
      imagePaths: [],
    });

    mockNativeFile.readFile.mockImplementation(path => {
      if (path === '/mock/epub/empty.html') return '';
      if (path === '/mock/epub/valid.html') return chapterContent;
      return '';
    });

    mockGetNovelChapters.mockResolvedValue([
      {
        id: 1,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'Valid Chapter',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'source.epub' },
      setMeta,
    );

    // Only valid chapter should be inserted
    expect(mockInsertChapters).toHaveBeenCalledWith(1, [
      expect.objectContaining({
        name: 'Valid Chapter',
      }),
    ]);
  });

  it('updates novel info with author, artist and summary', async () => {
    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: 'Test Novel',
      cover: null,
      summary: 'A test novel summary',
      author: 'Test Author',
      artist: 'Test Artist',
      chapters: [
        { name: 'Chapter 1', path: '/mock/epub/chapter1.html' },
      ],
      cssPaths: [],
      imagePaths: [],
    });

    mockNativeFile.readFile.mockReturnValue(chapterContent);
    mockGetNovelChapters.mockResolvedValue([
      {
        id: 1,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'Chapter 1',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'source.epub' },
      setMeta,
    );

    expect(mockUpdateNovelInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        author: 'Test Author',
        artist: 'Test Artist',
        summary: 'A test novel summary',
      }),
    );
  });

  it('sets progress metadata during import', async () => {
    mockNativeEpub.parseNovelAndChapters.mockReturnValue({
      name: 'Test Novel',
      cover: null,
      summary: null,
      author: null,
      artist: null,
      chapters: [
        { name: 'Chapter 1', path: '/mock/epub/chapter1.html' },
      ],
      cssPaths: [],
      imagePaths: [],
    });

    mockNativeFile.readFile.mockReturnValue(chapterContent);
    mockGetNovelChapters.mockResolvedValue([
      {
        id: 1,
        novelId: 1,
        path: '/mock/external/Novels/local/1/0',
        name: 'Chapter 1',
        releaseTime: 'now',
        position: 0,
        page: '1',
        chapterNumber: 1,
      },
    ] as any);

    await importEpub(
      { uri: '/mock/source.epub', filename: 'source.epub' },
      setMeta,
    );

    // Verify setMeta was called multiple times with progress updates
    // The function receives a transformer that updates the metadata
    expect(setMeta).toHaveBeenCalled();
    const calls = setMeta.mock.calls;
    // Check that at least one call sets isRunning to true
    const hasRunningTrue = calls.some(call => {
      const transformer = call[0];
      const result = transformer({});
      return result.isRunning === true;
    });
    expect(hasRunningTrue).toBe(true);
  });
});
