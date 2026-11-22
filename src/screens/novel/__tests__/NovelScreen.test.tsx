import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import NovelScreen from '../NovelScreen';

const mockDownloadChapters = jest.fn();
const mockRefetchLibrary = jest.fn();
const mockUpdateNovelCategories = jest.fn();
const mockUpdateChapterProgressByIds = jest.fn();
const mockUseNovelValue = jest.fn();
const mockUseNovelActions = jest.fn();

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: () => undefined,
}));

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({
    downloadNewChapters: false,
    refreshNovelMetadata: false,
  }),
  useTheme: () => ({
    primary: '#111',
    onSurface: '#222',
    background: '#333',
    onBackground: '#444',
    surface: '#555',
    surface2: '#666',
  }),
  useDownload: () => ({
    downloadChapters: mockDownloadChapters,
  }),
}));

jest.mock('../hooks/useNovelRefresh', () => ({
  useNovelRefresh: () => ({
    refresh: jest.fn(),
    updating: false,
  }),
}));

jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: {
    enqueue: jest.fn(),
  },
}));

jest.mock('@hooks', () => {
  const { useState } = require('react');
  return {
    useBoolean: () => {
      const [value, setValue] = useState(false);
      return {
        value,
        setTrue: () => setValue(true),
        setFalse: () => setValue(false),
      };
    },
  };
});

jest.mock('../NovelContext', () => ({
  useNovelValue: (key: string) => mockUseNovelValue(key),
  useNovelActions: () => mockUseNovelActions(),
}));

jest.mock('@services/plugin/fetch', () => ({
  resolveUrl: jest.fn(() => 'https://example.com'),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getAllUndownloadedAndUnreadChapters: jest.fn().mockResolvedValue([]),
  getAllUndownloadedChapters: jest.fn().mockResolvedValue([]),
  getChaptersByIds: jest.fn().mockResolvedValue([]),
  updateChapterProgressByIds: (...args: unknown[]) =>
    mockUpdateChapterProgressByIds(...args),
}));

jest.mock('../../../database/queries/NovelQueries', () => ({
  pickCustomNovelCover: jest.fn().mockResolvedValue(undefined),
  updateNovelCategories: (...args: unknown[]) =>
    mockUpdateNovelCategories(...args),
}));

jest.mock('@components/Context/LibraryContext', () => ({
  useLibraryActions: () => ({ refetchLibrary: mockRefetchLibrary }),
}));

jest.mock('@database/queries/CategoryQueries', () => ({
  getCategoriesWithCount: jest
    .fn()
    .mockResolvedValue([{ id: 10, name: 'Reading', sort: 1, novelsCount: 0 }]),
}));

jest.mock('@components/Checkbox/Checkbox', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Checkbox: ({ label, onPress }: any) =>
      React.createElement(
        Pressable,
        { onPress },
        React.createElement(Text, null, label),
      ),
  };
});

jest.mock('../components/ExportNovelAsEpubButton', () => () => null);

jest.mock('../components/NovelScreenList', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: ({
      onSelectionAction,
      toolbar,
      selectionActions,
      error,
      onEditCategories,
    }: any) => {
      return React.createElement(
        View,
        null,
        React.createElement(Text, { testID: 'novel-appbar' }, 'appbar'),
        error ? React.createElement(Text, null, error) : null,
        React.createElement(Pressable, {
          testID: 'native-library-long-press',
          onLongPress: onEditCategories,
        }),
        ...toolbar.map((action: any) =>
          React.createElement(Pressable, {
            key: action.id,
            testID: action.id,
            onPress: action.run,
          }),
        ),
        ...selectionActions.map((action: any) =>
          React.createElement(Pressable, {
            key: action.id,
            testID: action.id,
            onPress: () => onSelectionAction(action.id, [10, 1001]),
          }),
        ),
      );
    },
  };
});

jest.mock('@components', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  const Container = ({ children }: { children: React.ReactNode }) => children;
  return {
    SafeAreaView: Container,
    Dialog: {
      Root: Container,
      ScrollArea: Container,
      Actions: Container,
      Title: ({ children }: any) => React.createElement(Text, null, children),
      Action: ({ children, onPress }: any) =>
        React.createElement(
          Pressable,
          { onPress },
          React.createElement(Text, null, children),
        ),
    },
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const Portal: any = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  Portal.Host = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  return {
    Portal,
    Snackbar: ({ visible, children }: any) =>
      visible ? React.createElement(React.Fragment, null, children) : null,
  };
});

jest.mock('../components/EditInfoModal', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'edit-info-modal' }, 'edit');
});

jest.mock('../components/DownloadCustomChapterModal', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () =>
    React.createElement(
      Text,
      { testID: 'download-custom-modal' },
      'download-custom',
    );
});

jest.mock('../components/LoadingAnimation/NovelScreenLoading', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () =>
    React.createElement(Text, { testID: 'novel-screen-loading' }, 'loading');
});

const baseNovel = {
  id: 7,
  path: '/novels/test',
  pluginId: 'plugin.test',
  name: 'Test Novel',
  inLibrary: false,
  totalPages: 1,
  isLocal: false,
};

const createStore = (overrides: Record<string, unknown> = {}) => {
  const state = {
    novel: baseNovel,
    chapters: [
      {
        id: 10,
        unread: true,
        isDownloaded: false,
        name: 'Chapter 10',
      },
      {
        id: 11,
        unread: false,
        isDownloaded: false,
        name: 'Chapter 11',
      },
      {
        id: 12,
        unread: true,
        isDownloaded: false,
        name: 'Chapter 12',
      },
    ],
    fetching: false,
    loading: false,
    error: undefined,
    novelSettings: {
      filter: [],
      excludedScanlators: [],
      sort: 'positionAsc',
    },
    pageIndex: 0,
    pages: ['1'],
    batchInformation: { batch: 0, total: 0, totalChapters: 0 },
    getNextChapterBatch: jest.fn(),
    loadUpToBatch: jest.fn(),
    setNovel: jest.fn(),
    bookmarkChapters: jest.fn(),
    markChaptersRead: jest.fn(),
    markChaptersUnreadAndResetProgress: jest.fn().mockResolvedValue(true),
    markPreviouschaptersRead: jest.fn(),
    markPreviousChaptersUnread: jest.fn(),
    refreshChapters: jest.fn(),
    deleteChapters: jest.fn(),
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
    setNovel: store.state.setNovel,
    bookmarkChapters: store.state.bookmarkChapters,
    markChaptersRead: store.state.markChaptersRead,
    markChaptersUnreadAndResetProgress:
      store.state.markChaptersUnreadAndResetProgress,
    markPreviouschaptersRead: store.state.markPreviouschaptersRead,
    markPreviousChaptersUnread: store.state.markPreviousChaptersUnread,
    deleteChapters: store.state.deleteChapters,
  });
};

const route = {
  params: {
    name: 'Route Novel',
    path: '/novels/test',
    pluginId: 'plugin.test',
    isLocal: false,
  },
};

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
};

describe('NovelScreen (task 12 context boundary cutover)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([true, false])(
    'refreshes the library when categories are set (inLibrary=%s)',
    async inLibrary => {
      const store = createStore({ novel: { ...baseNovel, inLibrary } });
      wireStoreSelectors(store);

      render(
        // @ts-expect-error narrowed test props
        <NovelScreen navigation={navigation} route={route} />,
      );

      fireEvent(screen.getByTestId('native-library-long-press'), 'longPress');
      fireEvent.press(await screen.findByText('Reading'));
      fireEvent.press(screen.getByText('common.ok'));

      await waitFor(() =>
        expect(mockUpdateNovelCategories).toHaveBeenCalledWith([7], [10]),
      );
      await waitFor(() => expect(mockRefetchLibrary).toHaveBeenCalled());
      const changes = inLibrary ? [] : [[{ ...baseNovel, inLibrary: true }]];
      expect(store.state.setNovel.mock.calls).toEqual(changes);
    },
  );

  it('uses novelStore action selectors for selected unread workflow', () => {
    const store = createStore();
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(screen.getByTestId('selection-check'));

    expect(store.state.markChaptersRead).toHaveBeenCalledWith([10, 1001]);
  });

  it('uses the atomic unread and progress-reset workflow', () => {
    const store = createStore();
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(screen.getByTestId('selection-check-outline'));

    expect(
      store.state.markChaptersUnreadAndResetProgress,
    ).toHaveBeenCalledTimes(1);
    expect(mockUpdateChapterProgressByIds).not.toHaveBeenCalled();
  });

  it('shows the not-found error view with back action and hidden appbar actions', () => {
    const store = createStore({
      novel: undefined,
      loading: false,
      error: 'Novel not found on the source',
    });
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    expect(screen.getByText('Novel not found on the source')).toBeTruthy();
    expect(screen.getByTestId('back')).toBeOnTheScreen();
    expect(screen.queryByTestId('overflow')).toBeNull();

    fireEvent.press(screen.getByTestId('back'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('keeps the error view hidden while the novel is still loading', () => {
    const store = createStore({
      novel: undefined,
      loading: true,
      error: 'Novel not found on the source',
    });
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    expect(screen.queryByText('Novel not found on the source')).toBeNull();
    expect(screen.getByTestId('novel-appbar')).toHaveTextContent('appbar');
  });

  it('keeps undefined-novel safety path for download action and guarded modals', () => {
    const store = createStore({ novel: undefined });
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    expect(screen.queryByTestId('edit-info-modal')).toBeNull();
    expect(screen.queryByTestId('download-custom-modal')).toBeNull();

    fireEvent.press(screen.getByTestId('selection-download-outline'));

    expect(mockDownloadChapters).not.toHaveBeenCalled();
  });
});
