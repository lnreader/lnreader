import { fireEvent, render, screen } from '@testing-library/react-native';
import NovelScreenList from '../NovelScreenList';

const mockUseNovelValue = jest.fn();
const mockUseNovelActions = jest.fn();
const mockDownloadChapter = jest.fn();
let mockDownloadingChapterIds = new Set<number>();

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
    downloadChapter: mockDownloadChapter,
  }),
  useTheme: () => ({
    primary: '#111',
    onPrimary: '#fff',
    surface2: '#222',
  }),
  useTranslation: () => ({
    translateChapter: jest.fn(),
    clearTranslation: jest.fn(),
    isTranslating: jest.fn(() => false),
    translatingIds: new Set<number>(),
  }),
  useChapterGeneralSettings: () => ({
    translationTargetLang: 'en',
  }),
}));

jest.mock('@hooks/index', () => ({
  useBoolean: () => ({
    value: false,
    setTrue: jest.fn(),
    setFalse: jest.fn(),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

jest.mock('@legendapp/list', () => {
  const React = require('react');
  const { View } = require('react-native');

  return {
    LegendList: ({ data, renderItem, ListHeaderComponent }: any) =>
      React.createElement(
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
      ),
  };
});

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

jest.mock('@strings/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('@specs/NativeFile', () => ({
  getConstants: () => ({ ExternalCachesDirectoryPath: '/tmp' }),
  copyFile: jest.fn(),
  unlink: jest.fn(),
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
    openPage: store.state.openPage,
    updateChapter: store.state.updateChapter,
    refreshNovel: store.state.refreshNovel,
  });
};

const navigation = { navigate: jest.fn() };
const listRef = { current: { scrollToOffset: jest.fn() } };
const headerOpacity = { set: jest.fn() };

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
    />,
  );

describe('NovelScreenList (task 12 context boundary cutover)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDownloadingChapterIds = new Set<number>();
  });

  it('uses novelStore selector actions', () => {
    const store = createStore();
    wireStoreSelectors(store);

    renderList();

    fireEvent.press(screen.getByTestId('delete-chapter-1'));

    expect(store.state.deleteChapter).toHaveBeenCalledTimes(1);
  });

  it('marks downloaded chapter when an id leaves downloading set', () => {
    const store = createStore();

    mockDownloadingChapterIds = new Set<number>([1]);
    wireStoreSelectors(store);

    const view = renderList();

    mockDownloadingChapterIds = new Set<number>();
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
      />,
    );

    expect(store.state.updateChapter).toHaveBeenCalledWith(0, {
      isDownloaded: true,
    });
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
