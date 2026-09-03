/**
 * Regression loop: confirming a purge must surface exactly ONE outcome
 * toast. The purge path wires the REAL NovelQueries.removeNovelsFromLibrary
 * (which toasts "removed from library" internally) while useHistoryPurge
 * also toasts the purge outcome — the user currently sees two toasts for
 * one action. Only @database/db and showToast are mocked here so the real
 * query's toast side effect stays observable.
 */

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import HistoryScreen from '../HistoryScreen';
import { History } from '@database/types';
import { showToast } from '@utils/showToast';
import { deleteNovelHistory } from '@database/queries/HistoryQueries';

function baseRow(id: number, novelId: number, novelName: string): History {
  return {
    id,
    novelId,
    path: `/novel/${novelId}/chapter/${id}`,
    name: `Chapter ${id}`,
    readTime: '2026-08-23T10:00:00Z',
    bookmark: false,
    unread: true,
    isDownloaded: false,
    updatedTime: null,
    page: null,
    progress: null,
    timeSpent: null,
    inLibrary: true,
    pluginId: 'test-plugin',
    novelName,
    novelPath: `/novel/${novelId}`,
    novelCover: null,
    chapterNumber: 1,
  };
}

const mockHistory: History[] = [
  { ...baseRow(1, 101, 'Novel A'), chapterNumber: 1 },
  { ...baseRow(2, 101, 'Novel A'), chapterNumber: 2 },
];

jest.mock('@components', () => {
  const ReactModule = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    EmptyView: () => null,
    ErrorScreenV2: () => null,
    SearchbarV2: () => null,
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      ReactModule.createElement(ReactModule.Fragment, null, children),
    IconButtonV2: ({ accessibilityLabel, onPress }: any) =>
      ReactModule.createElement(
        Pressable,
        { accessibilityLabel, onPress },
        ReactModule.createElement(Text, null, accessibilityLabel ?? 'icon'),
      ),
    NovelCoverImage: () => ReactModule.createElement(View, null),
    Checkbox: ({ status }: { status: boolean }) =>
      ReactModule.createElement(Text, null, `checkbox:${status}`),
    Dialog: jest.requireActual('@components/Dialog').Dialog,
    // Real dialog: the confirm button drives the real purge path.
    ConfirmationDialog: jest.requireActual(
      '@components/ConfirmationDialog/ConfirmationDialog',
    ).default,
  };
});

jest.mock('react-native-paper', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');

  const Portal: any = ({ children }: { children: React.ReactNode }) =>
    ReactModule.createElement(ReactModule.Fragment, null, children);
  Portal.Host = Portal;

  return {
    Portal,
    Button: ({ children, onPress, disabled }: any) =>
      ReactModule.createElement(
        Pressable,
        {
          onPress,
          disabled,
          accessibilityLabel:
            typeof children === 'string' ? children : 'paper-button',
        },
        ReactModule.createElement(Text, null, children),
      ),
  };
});

jest.mock('@components/Actionbar/Actionbar', () => ({
  Actionbar: ({
    actions,
  }: {
    actions: { icon: string; onPress: () => void }[];
  }) => {
    const ReactModule = require('react');
    const { Pressable, Text } = require('react-native');
    return actions.map(({ icon, onPress }) =>
      ReactModule.createElement(
        Pressable,
        { key: icon, accessibilityLabel: `action-${icon}`, onPress },
        ReactModule.createElement(Text, null, `action-${icon}`),
      ),
    );
  },
}));

jest.mock('@hooks', () => ({
  useSearch: () => ({
    searchText: '',
    setSearchText: jest.fn(),
    clearSearchbar: jest.fn(),
  }),
  useBackHandler: () => {},
  useBoolean: (initial = false) => {
    const ReactModule = require('react');
    const [value, setValue] = ReactModule.useState(initial);
    return {
      value,
      setTrue: () => setValue(true),
      setFalse: () => setValue(false),
    };
  },
}));

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({
    dateFormat: 'default',
    relativeTimestamps: true,
  }),
  useTheme: () => ({
    primary: '#111',
    onPrimary: '#fff',
    onSurface: '#222',
    onSurfaceVariant: '#333',
    background: '#444',
    onBackground: '#555',
    surface: '#666',
    surface2: '#777',
    surfaceVariant: '#888',
    rippleColor: '#999',
    scrim: '#000',
  }),
  useHistory: () => ({
    isLoading: false,
    history: mockHistory,
    clearAllHistory: jest.fn(),
    removeChapterFromHistory: jest.fn(),
    removeNovelFromHistory: jest.fn(),
    error: null,
  }),
  useDownload: () => ({
    downloadQueue: [],
  }),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getNovelDownloadedChapters: jest.fn(async (novelId: number) =>
    novelId === 101 ? [{ id: 1 }, { id: 2 }] : [],
  ),
  deleteChapters: jest.fn(async () => {}),
}));

jest.mock('@database/queries/HistoryQueries', () => ({
  deleteNovelHistory: jest.fn(async () => {}),
}));

jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: {
    cancelForNovels: jest.fn(async () => 0),
  },
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

// The global test/mocks/database.js stub replaces NovelQueries with a
// partial fake; re-register the REAL module so the purge path exercises
// the actual removeNovelsFromLibrary (toast side effect included).
jest.mock('@database/queries/NovelQueries', () =>
  jest.requireActual('@database/queries/NovelQueries'),
);

// Heavy imports inside the REAL NovelQueries module, stripped to load it
// in the test environment. removeNovelsFromLibrary itself stays real.
jest.mock('@services/plugin/fetch', () => ({
  fetchNovel: jest.fn(),
  resolveUrl: jest.fn(),
}));
jest.mock('@plugins/helpers/fetch', () => ({
  downloadFile: jest.fn(),
}));
jest.mock('@plugins/pluginManager', () => ({
  getPlugin: jest.fn(),
}));
jest.mock('@hooks/persisted/useSettings', () => ({
  getLibraryDefaultCategoryId: jest.fn(() => null),
}));

// The real query's DB writes land on this fake transaction chain.
jest.mock('@database/db', () => {
  const run = jest.fn(async () => ({}));
  const where = () => ({ run });
  const set = () => ({ where });
  const tx = { update: () => ({ set }), delete: () => ({ where }) };
  return {
    dbManager: {
      write: jest.fn(async (callback: (tx: unknown) => Promise<void>) =>
        callback(tx),
      ),
    },
  };
});

const fakeNavigation = {
  addListener: jest.fn(() => jest.fn()),
  isFocused: jest.fn(() => false),
  navigate: jest.fn(),
};

describe('purge outcome toasting (one toast per action)', () => {
  it('confirming a purge shows exactly one toast', async () => {
    render(
      <HistoryScreen
        navigation={fakeNavigation as never}
        route={{} as never}
      />,
    );

    // Select the novel and open the confirm dialog.
    fireEvent(screen.getAllByText('Novel A')[0], 'longPress');
    fireEvent.press(screen.getByLabelText('action-delete-outline'));
    await screen.findByText(/purgeWarning/);

    // Confirm -> runs the real purge path (real removeNovelsFromLibrary).
    fireEvent.press(screen.getByLabelText('common.delete'));

    // Purge reached its last stage: history cleared.
    await waitFor(() => expect(deleteNovelHistory).toHaveBeenCalledWith(101));

    // Exactly ONE toast for the whole action: the purge outcome.
    expect(showToast).toHaveBeenCalledTimes(1);
    expect((showToast as jest.Mock).mock.calls[0][0]).toContain('purgeSuccess');
  });
});
