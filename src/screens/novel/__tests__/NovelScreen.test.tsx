import { fireEvent, render, screen } from '@testing-library/react-native';
import NovelScreen from '../NovelScreen';

const mockDownloadChapters = jest.fn();
const mockUpdateChapterProgressByIds = jest.fn();
const mockUseNovelValue = jest.fn();
const mockUseNovelActions = jest.fn();

jest.mock('@hooks/persisted', () => ({
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
  useTranslation: () => ({
    translateChapters: jest.fn(),
  }),
}));

jest.mock('@hooks', () => ({
  useBoolean: () => ({
    value: false,
    setTrue: jest.fn(),
    setFalse: jest.fn(),
  }),
}));

jest.mock('../NovelContext', () => ({
  useNovelValue: (key: string) => mockUseNovelValue(key),
  useNovelActions: () => mockUseNovelActions(),
}));

jest.mock('@services/plugin/fetch', () => ({
  resolveUrl: jest.fn(() => 'https://example.com'),
}));

jest.mock('@strings/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getAllUndownloadedAndUnreadChapters: jest.fn().mockResolvedValue([]),
  getAllUndownloadedChapters: jest.fn().mockResolvedValue([]),
  updateChapterProgressByIds: (...args: unknown[]) =>
    mockUpdateChapterProgressByIds(...args),
}));

jest.mock('../../../database/queries/NovelQueries', () => ({
  pickCustomNovelCover: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../components/NovelAppbar', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () => React.createElement(Text, { testID: 'novel-appbar' }, 'appbar');
});

jest.mock('../components/NovelScreenList', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    __esModule: true,
    default: ({ setSelected }: any) => {
      const base = {
        id: 1,
        novelId: 7,
        path: '/chapter/1',
        releaseTime: '2026-01-01',
        updatedTime: '2026-01-01',
        readTime: '2026-01-01',
        chapterNumber: 1,
        bookmark: false,
        progress: 0,
        page: '1',
        name: 'Chapter 1',
      };

      return React.createElement(
        View,
        null,
        React.createElement(
          Pressable,
          {
            testID: 'select-unread',
            onPress: () =>
              setSelected([
                { ...base, id: 10, unread: true, isDownloaded: false },
              ]),
          },
          React.createElement(Text, null, 'select-unread'),
        ),
        React.createElement(
          Pressable,
          {
            testID: 'select-read',
            onPress: () =>
              setSelected([
                { ...base, id: 11, unread: false, isDownloaded: false },
              ]),
          },
          React.createElement(Text, null, 'select-read'),
        ),
        React.createElement(
          Pressable,
          {
            testID: 'select-undownloaded',
            onPress: () =>
              setSelected([
                { ...base, id: 12, unread: true, isDownloaded: false },
              ]),
          },
          React.createElement(Text, null, 'select-undownloaded'),
        ),
      );
    },
  };
});

jest.mock('../../../components/Actionbar/Actionbar', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    Actionbar: ({ active, actions }: any) => {
      if (!active) return null;

      return React.createElement(
        View,
        { testID: 'actionbar' },
        ...actions.map((action: any) =>
          React.createElement(
            Pressable,
            {
              key: action.icon,
              testID: `action-${action.icon}`,
              onPress: action.onPress,
            },
            React.createElement(Text, null, action.icon),
          ),
        ),
      );
    },
  };
});

jest.mock('@components', () => {
  const React = require('react');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');

  const Portal: any = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  Portal.Host = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);

  return {
    Portal,
    Appbar: {
      Action: ({ icon, onPress }: any) =>
        React.createElement(
          Pressable,
          { testID: `appbar-action-${icon}`, onPress },
          React.createElement(Text, null, icon),
        ),
      Content: ({ title }: any) => React.createElement(Text, null, title),
    },
    Snackbar: ({ visible, children }: any) =>
      visible ? React.createElement(React.Fragment, null, children) : null,
  };
});

jest.mock('../components/JumpToChapterModal', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return () =>
    React.createElement(Text, { testID: 'jump-to-chapter-modal' }, 'jump');
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
    chapters: [],
    fetching: false,
    batchInformation: { batch: 0, total: 0, totalChapters: 0 },
    getNextChapterBatch: jest.fn(),
    loadUpToBatch: jest.fn(),
    setNovel: jest.fn(),
    bookmarkChapters: jest.fn(),
    markChaptersRead: jest.fn(),
    markChaptersUnread: jest.fn(),
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
    markChaptersUnread: store.state.markChaptersUnread,
    markPreviouschaptersRead: store.state.markPreviouschaptersRead,
    markPreviousChaptersUnread: store.state.markPreviousChaptersUnread,
    refreshChapters: store.state.refreshChapters,
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

  it('uses novelStore action selectors for selected unread workflow', () => {
    const store = createStore();
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(screen.getByTestId('select-unread'));
    fireEvent.press(screen.getByTestId('action-check'));

    expect(store.state.markChaptersRead).toHaveBeenCalledTimes(1);
  });

  it('preserves selected-read workflow parity (mark unread + reset progress + refresh)', () => {
    const store = createStore();
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    fireEvent.press(screen.getByTestId('select-read'));
    fireEvent.press(screen.getByTestId('action-check-outline'));

    expect(store.state.markChaptersUnread).toHaveBeenCalledTimes(1);
    expect(mockUpdateChapterProgressByIds).toHaveBeenCalledWith([11], 0);
    expect(store.state.refreshChapters).toHaveBeenCalledTimes(1);
  });

  it('keeps undefined-novel safety path for download action and guarded modals', () => {
    const store = createStore({ novel: undefined });
    wireStoreSelectors(store);

    render(
      // @ts-expect-error narrowed test props
      <NovelScreen navigation={navigation} route={route} />,
    );

    expect(screen.queryByTestId('jump-to-chapter-modal')).toBeNull();
    expect(screen.queryByTestId('edit-info-modal')).toBeNull();
    expect(screen.queryByTestId('download-custom-modal')).toBeNull();

    fireEvent.press(screen.getByTestId('select-undownloaded'));
    fireEvent.press(screen.getByTestId('action-download-outline'));

    expect(mockDownloadChapters).not.toHaveBeenCalled();
  });
});
