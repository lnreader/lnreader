import { act, fireEvent, render, screen, waitFor } from '@test-utils';
import {
  ChapterListViewCommands,
  createChapterListStore,
} from '@modules/nitro-chapter-list';
import NovelScreenList from '../NovelScreenList';

const mockUseNovelValue = jest.fn();
const mockUseNovelActions = jest.fn();
const mockDownloadChapter = jest.fn();
let mockDownloadingChapterIds = new Set<number>();
let mockDownloadingNovelIds = new Set<number>();
let mockDownloadQueue: any[] = [];

jest.mock('../../NovelContext', () => ({
  useNovelValue: (key: string) => mockUseNovelValue(key),
  useNovelActions: () => mockUseNovelActions(),
}));

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({
    useFabForContinueReading: true,
    disableHapticFeedback: true,
    downloadNewChapters: false,
    refreshNovelMetadata: false,
  }),
  useDownload: () => ({
    downloadingChapterIds: mockDownloadingChapterIds,
    downloadingNovelIds: mockDownloadingNovelIds,
    downloadChapter: mockDownloadChapter,
  }),
  useTheme: () => ({
    primary: '#111',
    onPrimary: '#fff',
    surface2: '#222',
  }),
}));

jest.mock('@hooks/persisted/useBackgroundTasks', () => ({
  useBackgroundTasks: (selector: (tasks: unknown[]) => unknown) =>
    selector(mockDownloadQueue),
  useBackgroundTaskQueue: () => mockDownloadQueue,
}));

jest.mock('@hooks/index', () => ({
  useBoolean: () => ({
    value: false,
    setTrue: jest.fn(),
    setFalse: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = jest.requireActual('react-native');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };
  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactModule.createElement(View, props, children),
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('../Info/NovelInfoHeader', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () =>
    React.createElement(Text, { testID: 'novel-info-header' }, 'hdr');
});

jest.mock('../PagePaginationControl', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return ({ onPageChange }: any) =>
    React.createElement(
      View,
      null,
      React.createElement(
        Pressable,
        { testID: 'pagination-change-page', onPress: () => onPageChange(1) },
        React.createElement(Text, null, 'change-page'),
      ),
    );
});

jest.mock('../NovelBottomSheet', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () =>
    React.createElement(Text, { testID: 'novel-bottom-sheet' }, 'nbs');
});

jest.mock('../Tracker/TrackSheet', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'track-sheet' }, 'track');
});

jest.mock('../PageNavigationBottomSheet', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () =>
    React.createElement(Text, { testID: 'page-navigation-sheet' }, 'navsheet');
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  return {
    ...jest.requireActual('react-native-paper'),
    AnimatedFAB: ({ onPress, label }: any) =>
      React.createElement(
        Pressable,
        {
          testID: label ? 'continue-reading-fab' : 'scroll-to-top-fab',
          onPress,
        },
        React.createElement(Text, null, label || 'fab'),
      ),
  };
});

jest.mock('@components/Skeleton/Skeleton', () => ({
  ChapterListSkeleton: () => null,
}));

jest.mock('@database/queries/NovelQueries', () => ({
  pickCustomNovelCover: jest.fn(),
}));

jest.mock('@services/updates/LibraryUpdateQueries', () => ({
  updateNovel: jest.fn(),
  updateNovelPage: jest.fn(),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@modules/native-file', () => ({
  __esModule: true,
  default: {
    ExternalCachesDirectoryPath: '/tmp',
    copyFile: jest.fn(),
    copyFileToDirectory: jest.fn(),
    pickDirectory: jest.fn(),
    unlink: jest.fn(),
  },
}));

jest.mock('@plugins/helpers/fetch', () => ({
  downloadFile: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(),
    createFileAsync: jest.fn(),
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

const baseChapter = {
  id: 1,
  novelId: 7,
  path: '/chapter/1',
  name: 'Chapter 1',
  releaseTime: '2026-01-01',
  updatedTime: '2026-01-01',
  readTime: '2026-01-01',
  chapterNumber: 1,
  bookmark: false,
  progress: 0,
  page: '1',
  unread: true,
  isDownloaded: false,
};

const baseNovel = {
  id: 7,
  name: 'Test Novel',
  path: '/novel/test',
  pluginId: 'plugin.test',
  cover: null,
  inLibrary: false,
  isLocal: false,
  totalPages: 2,
};

const createStore = (overrides: Record<string, unknown> = {}) => {
  const state = {
    chapters: [baseChapter],
    deleteChapter: jest.fn(),
    fetching: false,
    firstUnreadChapter: { ...baseChapter, id: 2 },
    loading: false,
    novelSettings: { filter: [], showChapterTitles: false },
    pages: ['1', '2'],
    setNovel: jest.fn(),
    novel: baseNovel,
    batchInformation: { batch: 0, total: 1, totalChapters: 2 },
    pageIndex: 0,
    getChapters: jest.fn(),
    syncDownloadedChapters: jest.fn(),
    openPage: jest.fn(),
    updateChapter: jest.fn(),
    refreshNovel: jest.fn(),
    lastRead: undefined,
    ...overrides,
  };

  return {
    getState: () => state,
    subscribe: jest.fn(() => () => {}),
    state,
  };
};

const wireStoreSelectors = (store: ReturnType<typeof createStore>) => {
  mockUseNovelValue.mockImplementation(
    (key: keyof typeof store.state) => store.state[key],
  );
  mockUseNovelActions.mockReturnValue({
    deleteChapter: store.state.deleteChapter,
    setNovel: store.state.setNovel,
    getChapters: store.state.getChapters,
    syncDownloadedChapters: store.state.syncDownloadedChapters,
    openPage: store.state.openPage,
    updateChapter: store.state.updateChapter,
    refreshNovel: store.state.refreshNovel,
  });
};

const navigation = { navigate: jest.fn() };
const listRef = { current: { scrollToOffset: jest.fn() } };
const headerOpacity = { set: jest.fn() };
const onRefresh = jest.fn();

const renderList = () =>
  render(
    <NovelScreenList
      headerOpacity={headerOpacity as any}
      listRef={listRef as any}
      navigation={navigation}
      routeBaseNovel={{
        name: 'Route Novel',
        path: '/novel/test',
        pluginId: 'plugin.test',
      }}
      selected={[]}
      setSelected={jest.fn()}
      onRefresh={onRefresh}
      updating={false}
    />,
  );

describe('NovelScreenList (task 12 context boundary cutover)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadingChapterIds = new Set<number>();
    mockDownloadingNovelIds = new Set<number>();
    mockDownloadQueue = [];
  });

  it('uses novelStore selector actions', () => {
    const store = createStore();
    wireStoreSelectors(store);

    renderList();

    fireEvent(screen.getByTestId('native-chapter-list'), 'deletePress', {
      nativeEvent: { id: 1, position: 0 },
    });

    expect(store.state.deleteChapter).toHaveBeenCalledWith(baseChapter);
  });

  it('reconciles once after the novel download queue settles', () => {
    const store = createStore();

    mockDownloadingChapterIds = new Set<number>([1, 2]);
    mockDownloadingNovelIds = new Set<number>([baseNovel.id]);
    wireStoreSelectors(store);

    const view = renderList();

    mockDownloadingChapterIds = new Set<number>([2]);
    view.rerender(
      <NovelScreenList
        headerOpacity={headerOpacity as any}
        listRef={listRef as any}
        navigation={navigation}
        routeBaseNovel={{
          name: 'Route Novel',
          path: '/novel/test',
          pluginId: 'plugin.test',
        }}
        selected={[]}
        setSelected={jest.fn()}
        onRefresh={onRefresh}
        updating={false}
      />,
    );

    expect(store.state.syncDownloadedChapters).not.toHaveBeenCalled();

    mockDownloadingChapterIds = new Set<number>();
    mockDownloadingNovelIds = new Set<number>();
    view.rerender(
      <NovelScreenList
        headerOpacity={headerOpacity as any}
        listRef={listRef as any}
        navigation={navigation}
        routeBaseNovel={{
          name: 'Route Novel',
          path: '/novel/test',
          pluginId: 'plugin.test',
        }}
        selected={[]}
        setSelected={jest.fn()}
        onRefresh={onRefresh}
        updating={false}
      />,
    );

    expect(store.state.syncDownloadedChapters).toHaveBeenCalledTimes(1);
    expect(store.state.getChapters).not.toHaveBeenCalled();
    expect(store.state.updateChapter).not.toHaveBeenCalled();
  });

  it('reconciles chapter state as a novel download makes progress', () => {
    const store = createStore();
    mockDownloadingNovelIds = new Set<number>([baseNovel.id]);
    mockDownloadQueue = [
      {
        id: 'download-1',
        task: {
          name: 'DOWNLOAD_CHAPTER',
          data: { novelId: baseNovel.id, chapters: [] },
        },
        state: 'running',
        meta: { progress: 0, isRunning: true },
      },
    ];
    wireStoreSelectors(store);

    const view = renderList();
    expect(store.state.syncDownloadedChapters).not.toHaveBeenCalled();

    mockDownloadQueue = [
      {
        ...mockDownloadQueue[0],
        meta: { progress: 0.5, isRunning: true },
      },
    ];
    view.rerender(
      <NovelScreenList
        headerOpacity={headerOpacity as any}
        listRef={listRef as any}
        navigation={navigation}
        routeBaseNovel={{
          name: 'Route Novel',
          path: '/novel/test',
          pluginId: 'plugin.test',
        }}
        selected={[]}
        setSelected={jest.fn()}
        onRefresh={onRefresh}
        updating={false}
      />,
    );

    expect(store.state.syncDownloadedChapters).toHaveBeenCalledTimes(1);
    expect(store.state.getChapters).not.toHaveBeenCalled();
  });

  it('uses selector-backed page navigation action from novelStore', () => {
    const store = createStore();
    wireStoreSelectors(store);

    renderList();

    fireEvent.press(screen.getByTestId('pagination-change-page'));

    expect(store.state.openPage).toHaveBeenCalledWith(1);
  });

  it('keeps continue-reading FAB navigation parity with lastRead fallback chain', () => {
    const lastRead = { ...baseChapter, id: 42 };
    const store = createStore({
      firstUnreadChapter: { ...baseChapter, id: 99 },
      lastRead,
    });

    wireStoreSelectors(store);

    renderList();

    fireEvent.press(screen.getByTestId('continue-reading-fab'));

    expect(navigation.navigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Chapter',
      params: { novel: baseNovel, chapter: lastRead },
    });
  });
});

describe('NovelScreenList native chapter list', () => {
  const makeChapters = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...baseChapter,
      id: index + 1,
      name: `Chapter title ${index + 1}`,
      chapterNumber: index + 1,
    }));

  const renderWithStore = (
    store: ReturnType<typeof createStore>,
    selected: number[] = [],
  ) => {
    const loadUpToBatch = jest.fn().mockResolvedValue(undefined);
    const setSelected = jest.fn();
    mockUseNovelValue.mockImplementation(
      (key: keyof typeof store.state) => store.state[key],
    );
    mockUseNovelActions.mockReturnValue({
      deleteChapter: store.state.deleteChapter,
      setNovel: store.state.setNovel,
      getChapters: store.state.getChapters,
      syncDownloadedChapters: store.state.syncDownloadedChapters,
      openPage: store.state.openPage,
      loadUpToBatch,
    });
    const ref = {
      current: { scrollToOffset: jest.fn(), scrollToIndex: jest.fn() },
    };
    const element = (nextSelected: number[]) => (
      <NovelScreenList
        headerOpacity={headerOpacity as any}
        listRef={ref as any}
        navigation={navigation}
        routeBaseNovel={{
          name: 'Route Novel',
          path: '/novel/test',
          pluginId: 'plugin.test',
        }}
        selected={nextSelected}
        setSelected={setSelected}
        onRefresh={onRefresh}
        updating={false}
      />
    );
    const view = render(element(selected));
    const list = screen.getByTestId('native-chapter-list');
    const nativeStore = (createChapterListStore as jest.Mock).mock.results.at(
      -1,
    )?.value;
    return {
      ref,
      list,
      nativeStore,
      loadUpToBatch,
      setSelected,
      rerender: (nextSelected: number[]) =>
        view.rerender(element(nextSelected)),
    };
  };

  const fire = (list: any, name: string, nativeEvent: object) =>
    fireEvent(list, name, { nativeEvent });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadingChapterIds = new Set<number>();
    mockDownloadingNovelIds = new Set<number>();
  });

  it('sizes the native list to the total chapter count and sends loaded rows', () => {
    const store = createStore({
      chapters: makeChapters(3),
      batchInformation: { batch: 0, total: 3, totalChapters: 2500 },
    });
    const { nativeStore, list } = renderWithStore(store);

    expect(list.props.storeId).toBe(nativeStore.id);
    expect(nativeStore.reset).toHaveBeenCalledWith(2500);
    expect(nativeStore.setRows).toHaveBeenCalledWith(0, [
      expect.objectContaining({
        id: 1,
        name: 'Chapter title 1',
        numberText: '1',
        unread: true,
        downloaded: false,
      }),
      expect.objectContaining({ id: 2 }),
      expect.objectContaining({ id: 3 }),
    ]);
  });

  it("formats rows natively from the novel's display settings", () => {
    const store = createStore({
      chapters: makeChapters(1),
      novelSettings: { filter: [], showChapterTitles: true },
    });
    const { list } = renderWithStore(store);

    expect(list.props.rowFormat).toEqual(
      expect.objectContaining({
        showChapterTitles: true,
        dateFormat: 'default',
        relativeDates: true,
        lastWeek: expect.arrayContaining([expect.any(String)]),
      }),
    );
  });

  it('passes real booleans to the native view when SQLite returns 0/1', () => {
    const store = createStore({
      chapters: makeChapters(1),
      novel: { ...baseNovel, isLocal: 1 },
    });
    const { list } = renderWithStore(store);

    expect(list.props.isLocal).toBe(true);
    expect(list.props.refreshing).toBe(false);
  });

  it('loads the batch a placeholder range asks for', () => {
    const store = createStore({
      chapters: makeChapters(2),
      batchInformation: { batch: 0, total: 3, totalChapters: 2500 },
    });
    const { list, loadUpToBatch } = renderWithStore(store);

    fire(list, 'requestRange', { start: 1000, end: 1999 });
    expect(loadUpToBatch).toHaveBeenCalledWith(1);

    fire(list, 'requestRange', { start: 2000, end: 2499 });
    expect(loadUpToBatch).toHaveBeenLastCalledWith(2);
  });

  it('reports a batch that fails to load', async () => {
    const { showToast } = jest.requireMock('@utils/showToast');
    const store = createStore({
      chapters: makeChapters(2),
      batchInformation: { batch: 0, total: 3, totalChapters: 2500 },
    });
    const { list, loadUpToBatch } = renderWithStore(store);
    loadUpToBatch.mockRejectedValueOnce(new Error('database is locked'));

    fire(list, 'requestRange', { start: 1000, end: 1999 });

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('database is locked'),
    );
  });

  it('keeps the rows on screen and reloads them when chapters reload after a download', () => {
    const store = createStore({
      chapters: makeChapters(3000),
      batchInformation: { batch: 2, total: 3, totalChapters: 3000 },
    });
    const { nativeStore, loadUpToBatch, rerender } = renderWithStore(store);
    expect(nativeStore.reset).toHaveBeenCalledTimes(1);

    // getChapters: back to the first batch, as fresh chapter objects.
    store.state.chapters = makeChapters(1000);
    store.state.batchInformation = { batch: 0, total: 3, totalChapters: 3000 };
    rerender([]);

    expect(nativeStore.reset).toHaveBeenCalledTimes(1);
    expect(loadUpToBatch).toHaveBeenLastCalledWith(2);
  });

  it('asks again for a batch whose load a reload cancelled', () => {
    const store = createStore({
      chapters: makeChapters(1000),
      batchInformation: { batch: 0, total: 3, totalChapters: 3000 },
    });
    const { list, loadUpToBatch, rerender } = renderWithStore(store);

    fire(list, 'requestRange', { start: 2000, end: 2999 });
    expect(loadUpToBatch).toHaveBeenCalledTimes(1);

    // A second getChapters invalidates that load and lands on batch 0 again.
    store.state.fetching = true;
    rerender([]);
    store.state.chapters = makeChapters(1000);
    store.state.fetching = false;
    rerender([]);

    expect(loadUpToBatch).toHaveBeenCalledTimes(2);
    expect(loadUpToBatch).toHaveBeenLastCalledWith(2);
  });

  it('opens a chapter native still shows but JS has not loaded, via the database', async () => {
    const { getChapter } = jest.requireMock('@database/queries/ChapterQueries');
    const stale = { ...baseChapter, id: 2500, chapterNumber: 2500 };
    getChapter.mockResolvedValueOnce(stale);
    const store = createStore({ chapters: makeChapters(2) });
    const { list } = renderWithStore(store);

    fire(list, 'chapterPress', { id: 2500, position: 2499 });

    expect(getChapter).toHaveBeenCalledWith(2500);
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('ReaderStack', {
        screen: 'Chapter',
        params: { novel: baseNovel, chapter: stale },
      }),
    );
  });

  it('only asks for scroll events where the app bar and FABs need them', () => {
    const store = createStore({ chapters: makeChapters(2) });
    const { list } = renderWithStore(store);

    expect(list.props.scrollEventMaxOffset).toBe(200);
    expect(list.props.scrollEventThresholds).toEqual([expect.any(Number)]);
  });

  it('opens a chapter on press', () => {
    const store = createStore({ chapters: makeChapters(2) });
    const { list } = renderWithStore(store);

    fire(list, 'chapterPress', { id: 2, position: 1 });

    expect(navigation.navigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Chapter',
      params: {
        novel: baseNovel,
        chapter: expect.objectContaining({ id: 2 }),
      },
    });
  });

  it('starts selection on long press and toggles it on press in selection mode', () => {
    const store = createStore({ chapters: makeChapters(3) });
    const { list, setSelected, rerender } = renderWithStore(store);

    fire(list, 'chapterLongPress', { id: 2, position: 1 });
    const startSelection = setSelected.mock.calls[0][0];
    expect(startSelection([])).toEqual([2]);

    rerender([2]);
    fire(list, 'chapterPress', { id: 3, position: 2 });

    expect(navigation.navigate).not.toHaveBeenCalled();
    const toggle = setSelected.mock.calls[1][0];
    expect(toggle([2])).toEqual([2, 3]);
  });

  it('pushes selection and downloading state to the native store', () => {
    mockDownloadingChapterIds = new Set<number>([3]);
    const store = createStore({ chapters: makeChapters(3) });
    const { nativeStore, rerender } = renderWithStore(store);

    expect(nativeStore.setDownloading).toHaveBeenCalledWith([3]);
    expect(nativeStore.setSelected).toHaveBeenLastCalledWith([]);

    rerender([1, 2]);

    expect(nativeStore.setSelected).toHaveBeenLastCalledWith([1, 2]);
  });

  it('downloads a chapter from its download button', () => {
    const store = createStore({ chapters: makeChapters(2) });
    const { list } = renderWithStore(store);

    fire(list, 'downloadPress', { id: 2, position: 1 });

    expect(mockDownloadChapter).toHaveBeenCalledWith(
      baseNovel,
      expect.objectContaining({ id: 2 }),
    );
  });

  it('exposes scrollToIndex / scrollToOffset on the list ref as native commands', () => {
    const store = createStore({ chapters: makeChapters(2) });
    const { ref } = renderWithStore(store);

    act(() =>
      ref.current.scrollToIndex({
        index: 5,
        animated: true,
        viewPosition: 0.5,
      }),
    );
    act(() => ref.current.scrollToOffset({ offset: 0, animated: false }));

    expect(ChapterListViewCommands.scrollToIndex).toHaveBeenCalledWith(
      expect.anything(),
      5,
      true,
      0.5,
    );
    expect(ChapterListViewCommands.scrollToOffset).toHaveBeenCalledWith(
      expect.anything(),
      0,
      false,
    );
  });
});
