import { NovelInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { createNovelStoreActions } from '../store/novelStore.actions';

interface BootstrapServiceSlice {
  bootstrapNovelAsync: jest.Mock;
  bootstrapNovelSync: jest.Mock;
  getNextChapterBatch: jest.Mock;
  loadUpToBatch: jest.Mock;
}

const mockNovel: NovelInfo = {
  id: 1,
  path: '/novels/x',
  name: 'X',
  pluginId: 'plugin.test',
};

interface TestState {
  novel: NovelInfo | undefined;
  novelPath: string;
  pluginId: string;
  pageIndex: number;
  pages: string[];
  novelSettings: { filter: never[]; excludedScanlators: never[] };
  loading: boolean;
  fetching: boolean;
  error: string | undefined;
}

const createHarness = (overrides: Partial<TestState> = {}) => {
  let state: TestState = {
    novel: undefined,
    novelPath: '/x',
    pluginId: 'plugin.test',
    pageIndex: 0,
    pages: [],
    novelSettings: { filter: [], excludedScanlators: [] },
    loading: false,
    fetching: false,
    error: undefined,
    ...overrides,
  };

  const set = jest.fn(
    (partial: Partial<TestState> | ((s: TestState) => Partial<TestState>)) => {
      const patch = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...patch };
    },
  );
  const get = () => state;
  const bootstrapService: jest.Mocked<BootstrapServiceSlice> = {
    bootstrapNovelAsync: jest.fn(),
    bootstrapNovelSync: jest.fn(),
    getNextChapterBatch: jest.fn(),
    loadUpToBatch: jest.fn(),
  };
  let requestVersion = 0;
  const chapterRequestCoordinator = {
    current: jest.fn(() => requestVersion),
    invalidate: jest.fn(() => ++requestVersion),
  };
  const transformChapters = jest.fn(chs => chs);

  const actions = createNovelStoreActions({
    //@ts-expect-error partial state/actions for testing
    set, //@ts-expect-error
    get,
    deps: {
      bootstrapService,
      chapterActionsDependencies: {} as never,
      chapterRequestCoordinator,
      transformChapters,
    } as never,
    defaultChapterSort: 'positionAsc',
  });

  return {
    actions,
    getState: () => state,
    bootstrapService,
    chapterRequestCoordinator,
  };
};

describe('novelStore.bootstrap', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps a missing novel to the not-found error', async () => {
    const harness = createHarness();
    harness.bootstrapService.bootstrapNovelAsync.mockResolvedValue({
      ok: false,
      reason: 'missing-novel',
    });

    const ok = await harness.actions.bootstrapNovel();

    expect(ok).toBe(false);
    expect(harness.getState().error).toBe(getString('novelScreen.notFound'));
    expect(harness.getState().loading).toBe(false);
  });

  it('maps a bootstrap error to the custom not-found message, never the raw error', async () => {
    const harness = createHarness();
    harness.bootstrapService.bootstrapNovelAsync.mockResolvedValue({
      ok: false,
      reason: 'error',
      error: new Error('boom'),
    });

    const ok = await harness.actions.bootstrapNovel();

    expect(ok).toBe(false);
    expect(harness.getState().error).toBe(getString('novelScreen.notFound'));
    expect(harness.getState().error).not.toBe('boom');
  });

  it('clears the error on a successful bootstrap', async () => {
    const harness = createHarness({ error: 'previous error' });
    harness.bootstrapService.bootstrapNovelAsync.mockResolvedValue({
      ok: true,
      novel: mockNovel,
      pages: ['1'],
      pageIndex: 0,
      scanlators: [],
      chapters: [],
      batchInformation: { batch: 0, total: 0, totalChapters: 0 },
      firstUnreadChapter: undefined,
    });

    const ok = await harness.actions.bootstrapNovel();

    expect(ok).toBe(true);
    expect(harness.getState().error).toBeUndefined();
    expect(harness.getState().novel).toBe(mockNovel);
  });
});
