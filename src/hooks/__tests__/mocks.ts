jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@strings/translations', () => ({
  getString: jest.fn(key => key),
}));

jest.mock('@utils/parseChapterNumber', () => ({
  parseChapterNumber: jest.fn(() => 1),
}));

jest.mock('@utils/Storages', () => ({
  NOVEL_STORAGE: '/mock/storage',
}));

jest.mock('@hooks/persisted/usePlugins');
jest.mock('@hooks/persisted/useTracker');
jest.mock('@hooks/persisted/useDownload');
jest.mock('@hooks/persisted/useUserAgent');
jest.mock('@hooks/persisted/useSettings');

jest.mock('@hooks/persisted/useNovelSettings');
jest.mock('@hooks/persisted/useHistory');
jest.mock('@hooks/persisted/useImport');
jest.mock('@hooks/persisted/useSelfHost');
jest.mock('@hooks/persisted/useTheme');
jest.mock('@hooks/persisted/useTrackedNovel');
jest.mock('@hooks/persisted/useUpdates');
jest.mock('@services/plugin/fetch');
jest.mock('@components/Context/LibraryContext');

const createMockChapterTextCache = () => {
  const cache = new Map<number, string | Promise<string>>();

  return {
    read: jest.fn((chapterId: number) => cache.get(chapterId)),
    write: jest.fn((chapterId: number, value: string | Promise<string>) => {
      cache.set(chapterId, value);
    }),
    remove: jest.fn((chapterId: number) => cache.delete(chapterId)),
    clear: jest.fn(() => cache.clear()),
  };
};

export const createMockNovelStoreState = (
  overrides: Record<string, unknown> = {},
) => ({
  loading: false,
  fetching: false,
  pageIndex: 0,
  pages: ['1'],
  novel: undefined,
  chapters: [],
  firstUnreadChapter: undefined,
  batchInformation: {
    batch: 0,
    total: 0,
  },
  novelSettings: {
    filter: [],
    showChapterTitles: true,
  },
  chapterTextCache: createMockChapterTextCache(),
  lastRead: undefined,

  bootstrapNovel: jest.fn().mockResolvedValue(true),
  getChapters: jest.fn().mockResolvedValue(undefined),
  getNextChapterBatch: jest.fn().mockResolvedValue(undefined),
  loadUpToBatch: jest.fn().mockResolvedValue(undefined),
  refreshNovel: jest.fn().mockResolvedValue(undefined),

  setNovel: jest.fn(),
  setPages: jest.fn(),
  setPageIndex: jest.fn(),
  openPage: jest.fn().mockResolvedValue(undefined),
  setNovelSettings: jest.fn(),
  setLastRead: jest.fn(),
  followNovel: jest.fn(),

  updateChapter: jest.fn(),
  setChapters: jest.fn(),
  extendChapters: jest.fn(),

  bookmarkChapters: jest.fn(),
  markPreviouschaptersRead: jest.fn(),
  markChapterRead: jest.fn(),
  markChaptersRead: jest.fn(),
  markPreviousChaptersUnread: jest.fn(),
  markChaptersUnread: jest.fn(),
  updateChapterProgress: jest.fn(),
  deleteChapter: jest.fn(),
  deleteChapters: jest.fn(),
  refreshChapters: jest.fn(),
  ...overrides,
});

export const createMockNovelStore = (
  stateOverrides: Record<string, unknown> = {},
) => {
  let state = createMockNovelStoreState(stateOverrides);

  return {
    getState: jest.fn(() => state),
    setState: jest.fn(nextState => {
      const partial =
        typeof nextState === 'function' ? nextState(state) : nextState;
      state = {
        ...state,
        ...partial,
      };
    }),
    subscribe: jest.fn(() => () => {}),
  };
};

const defaultMockNovelContext = {
  novelStore: createMockNovelStore(),
  navigationBarHeight: 0,
  statusBarHeight: 0,
};

export const mockUseNovelContext = jest.fn(() => defaultMockNovelContext);
export const mockUseNovelValue = jest.fn((key: string) => {
  const state = mockUseNovelContext()?.novelStore?.getState?.() ?? {};
  return state[key as keyof typeof state];
});
export const mockUseNovelState = jest.fn(
  (selector: (state: any) => unknown) => {
    const state = mockUseNovelContext()?.novelStore?.getState?.() ?? {};
    return selector(state);
  },
);
export const mockUseNovelActions = jest.fn(() => {
  const state = mockUseNovelContext()?.novelStore?.getState?.() ?? {};
  const stateWithOptionalActions = state as Record<string, unknown> & {
    actions?: Record<string, unknown>;
  };
  return stateWithOptionalActions.actions ?? stateWithOptionalActions;
});
export const mockUseNovelAction = jest.fn((key: string) => {
  const actions = mockUseNovelActions();
  return actions?.[key];
});

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelContext: () => mockUseNovelContext(),
  useNovelValue: (key: string) => mockUseNovelValue(key),
  useNovelState: (selector: (state: any) => unknown) =>
    mockUseNovelState(selector),
  useNovelActions: () => mockUseNovelActions(),
  useNovelAction: (key: string) => mockUseNovelAction(key),
}));
