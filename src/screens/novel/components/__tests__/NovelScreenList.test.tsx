import { act, fireEvent, render, screen } from '@test-utils';
import NovelScreenList from '../NovelScreenList';

const mockUseNovelValue = jest.fn();
const mockUseNovelActions = jest.fn();
const mockDownloadChapter = jest.fn();
let mockDownloadingChapterIds = new Set<number>();
let mockDownloadingNovelIds = new Set<number>();
let mockDownloadQueue: any[] = [];
let mockFastScrollbarProps: any;

jest.mock('@components/FastScrollbar', () => ({
  useFastScrollMetrics: jest.requireActual(
    '@components/FastScrollbar/useFastScrollMetrics',
  ).useFastScrollMetrics,
  FastScrollbar: (props: any) => {
    mockFastScrollbarProps = props;
    return null;
  },
}));

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

const mockLegendList = ({ data, renderItem, ListHeaderComponent }: any) => {
  const React = require('react');
  const { View } = require('react-native');
  return React.createElement(
    View,
    null,
    ListHeaderComponent,
    ...(data || []).map((item: any, index: number) =>
      React.createElement(
        React.Fragment,
        { key: `row-${item.id ?? index}` },
        renderItem({ item, index }),
      ),
    ),
  );
};

jest.mock('@legendapp/list/react-native', () => ({
  LegendList: (props: any) => mockLegendList(props),
  LegendListRef: {},
}));

jest.mock('@legendapp/list/reanimated', () => ({
  AnimatedLegendList: (props: any) => mockLegendList(props),
}));

jest.mock('../ChapterItem', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return ({ chapter, onDeleteChapter }: any) =>
    React.createElement(
      View,
      { testID: `chapter-item-${chapter.id}` },
      React.createElement(
        Pressable,
        {
          testID: `delete-chapter-${chapter.id}`,
          onPress: () => onDeleteChapter(chapter),
        },
        React.createElement(Text, null, 'delete'),
      ),
    );
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

    fireEvent.press(screen.getByTestId('delete-chapter-1'));

    expect(store.state.deleteChapter).toHaveBeenCalledTimes(1);
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

    expect(store.state.getChapters).not.toHaveBeenCalled();

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

    expect(store.state.getChapters).toHaveBeenCalledTimes(1);
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
    expect(store.state.getChapters).not.toHaveBeenCalled();

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

    expect(store.state.getChapters).toHaveBeenCalledTimes(1);
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

describe('NovelScreenList fast scroll', () => {
  const makeChapters = (count: number) =>
    Array.from({ length: count }, (_, index) => ({
      ...baseChapter,
      id: index + 1,
      name: `Chapter title ${index + 1}`,
      chapterNumber: index + 1,
    }));

  const renderWithStore = (store: ReturnType<typeof createStore>) => {
    const loadUpToBatch = jest.fn();
    mockUseNovelValue.mockImplementation(
      (key: keyof typeof store.state) => store.state[key],
    );
    mockUseNovelActions.mockReturnValue({
      deleteChapter: store.state.deleteChapter,
      setNovel: store.state.setNovel,
      getChapters: store.state.getChapters,
      openPage: store.state.openPage,
      loadUpToBatch,
    });
    const ref = {
      current: { scrollToOffset: jest.fn(), scrollToIndex: jest.fn() },
    };
    const element = () => (
      <NovelScreenList
        headerOpacity={headerOpacity as any}
        listRef={ref as any}
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
      />
    );
    const view = render(element());
    return { ref, loadUpToBatch, rerender: () => view.rerender(element()) };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFastScrollbarProps = undefined;
  });

  it('sizes the scrollbar to the total chapter count, not just loaded ones', () => {
    const store = createStore({
      chapters: makeChapters(3),
      batchInformation: { batch: 0, total: 2, totalChapters: 2500 },
    });
    renderWithStore(store);

    expect(mockFastScrollbarProps.itemCount).toBe(2500);
    expect(mockFastScrollbarProps.loadedCount).toBe(3);
  });

  it('drives the chapter list and loads the batch for unloaded chapters', () => {
    const store = createStore({
      chapters: makeChapters(2),
      batchInformation: { batch: 0, total: 2, totalChapters: 2500 },
    });
    const { ref, loadUpToBatch } = renderWithStore(store);

    expect(mockFastScrollbarProps.listRef).toBe(ref);

    act(() => mockFastScrollbarProps.onRequestItems(1001));
    expect(loadUpToBatch).toHaveBeenCalledWith(1);

    act(() => mockFastScrollbarProps.onRequestItems(2499));
    expect(loadUpToBatch).toHaveBeenLastCalledWith(2);
  });
});
