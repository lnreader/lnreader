jest.mock('@database/queries/NovelQueries', () => ({
  getNovelById: jest.fn(),
  getNovelByPath: jest.fn(),
  deleteCachedNovels: jest.fn(),
  getCachedNovels: jest.fn(),
  insertNovelAndChapters: jest.fn(),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  getCategoriesFromDb: jest.fn(),
  getCategoriesWithCount: jest.fn(),
  createCategory: jest.fn(),
  deleteCategoryById: jest.fn(),
  updateCategory: jest.fn(),
  isCategoryNameDuplicate: jest.fn(),
  updateCategoryOrderInDb: jest.fn(),
  getAllNovelCategories: jest.fn(),
  _restoreCategory: jest.fn(),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  bookmarkChapter: jest.fn(),
  markChapterRead: jest.fn(),
  markChaptersRead: jest.fn(),
  markPreviuschaptersRead: jest.fn(),
  markPreviousChaptersUnread: jest.fn(),
  markChaptersUnread: jest.fn(),
  deleteChapter: jest.fn(),
  deleteChapters: jest.fn(),
  getPageChapters: jest.fn(),
  insertChapters: jest.fn(),
  getCustomPages: jest.fn(),
  getChapterCount: jest.fn(),
  getChapterCountSync: jest.fn(),
  getPageChaptersBatched: jest.fn(),
  getNovelChaptersSync: jest.fn(),
  getFirstUnreadChapter: jest.fn(),
  updateChapterProgress: jest.fn(),
  getNovelScanlators: jest.fn(() => []),
  getNovelScanlatorsSync: jest.fn(() => []),
}));

jest.mock('@database/queries/HistoryQueries', () => ({
  getHistoryFromDb: jest.fn(),
  insertHistory: jest.fn(),
  deleteChapterHistory: jest.fn(),
  deleteAllHistory: jest.fn(),
}));

jest.mock('@database/queries/LibraryQueries', () => ({
  getLibraryNovelsFromDb: jest.fn(),
  getLibraryNovelsQuery: jest.fn(),
  getLibraryWithCategory: jest.fn(),
}));

jest.mock('@database/queries/RepositoryQueries', () => ({
  getRepositoriesFromDb: jest.fn(),
  isRepoUrlDuplicated: jest.fn(),
  createRepository: jest.fn(),
  deleteRepositoryById: jest.fn(),
  updateRepository: jest.fn(),
  setRepositoryEnabled: jest.fn(),
}));

jest.mock('@database/queries/StatsQueries', () => ({
  getLibraryStatsFromDb: jest.fn(),
  getChaptersTotalCountFromDb: jest.fn(),
  getChaptersReadCountFromDb: jest.fn(),
  getChaptersUnreadCountFromDb: jest.fn(),
  getChaptersDownloadedCountFromDb: jest.fn(),
  getNovelGenresFromDb: jest.fn(),
  getNovelStatusFromDb: jest.fn(),
}));

// The native SQLite driver does not exist under Jest. Screen tests only need
// the module graph to load; tests exercising queries mock them explicitly.
jest.mock('@op-engineering/op-sqlite', () => ({
  open: jest.fn(() => ({
    execute: jest.fn(async () => ({ rows: [] })),
    executeSync: jest.fn(() => ({ rows: [] })),
    executeRaw: jest.fn(async () => []),
    executeRawSync: jest.fn(() => []),
    executeBatch: jest.fn(async () => undefined),
    transaction: jest.fn(async fn => fn({ execute: jest.fn() })),
    close: jest.fn(),
    reactiveExecute: jest.fn(() => () => undefined),
    updateHook: jest.fn(),
  })),
}));

jest.mock('@database/manager/liveQuery', () => ({
  useLiveQuery: jest.fn(() => []),
}));
