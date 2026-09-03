/**
 * Regression loop: purge-dialog counts must be per-NOVEL, not per history
 * ROW. History rows are per-chapter (History extends ChapterInfo), so one
 * selected novel can span several rows; the confirm dialog must dedupe by
 * novelId before counting novels, library novels, and downloaded chapters.
 */

import { fireEvent, render, screen } from '@testing-library/react-native';

import HistoryScreen from '../HistoryScreen';
import { History } from '@database/types';

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
  // Minimal scenario: ONE selected novel spanning THREE history rows
  // (per-chapter rows are what inflate the dialog counts).
  { ...baseRow(1, 101, 'Novel A'), chapterNumber: 1 },
  { ...baseRow(2, 101, 'Novel A'), chapterNumber: 2 },
  { ...baseRow(3, 101, 'Novel A'), chapterNumber: 3 },
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
    // Real dialog: the rendered message is this suite's assertion surface.
    ConfirmationDialog: jest.requireActual(
      '@components/ConfirmationDialog/ConfirmationDialog',
    ).default,
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

jest.mock('react-native-paper', () => {
  const ReactModule = require('react');
  const { Pressable, Text } = require('react-native');

  const Portal: any = ({ children }: { children: React.ReactNode }) =>
    ReactModule.createElement(ReactModule.Fragment, null, children);
  Portal.Host = Portal;

  return {
    Portal,
    // Minimal Button for the real Dialog.Action confirm/cancel buttons.
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
  // Interpolating mock so counts are assertable in rendered text.
  getString: (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getNovelDownloadedChapters: jest.fn(async (novelId: number) =>
    novelId === 101
      ? [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }]
      : [],
  ),
  deleteChapters: jest.fn(async () => {}),
}));

jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: {
    cancelForNovels: jest.fn(async () => 0),
  },
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

const fakeNavigation = {
  addListener: jest.fn(() => jest.fn()),
  isFocused: jest.fn(() => false),
  navigate: jest.fn(),
};

const renderScreen = () =>
  render(
    <HistoryScreen navigation={fakeNavigation as never} route={{} as never} />,
  );

describe('purge confirm dialog counts (per novel, not per history row)', () => {
  it('one selected novel with three read chapters counts as 1 novel / its downloaded chapters once', async () => {
    renderScreen();

    // Long-press any Novel A row -> select mode with novel 101 selected.
    fireEvent(screen.getAllByText('Novel A')[0], 'longPress');

    // Action bar delete -> opens the confirm dialog with live counts.
    fireEvent.press(screen.getByLabelText('action-delete-outline'));

    await screen.findByText(/purgeWarning/);

    // The dialog description is one string: warning line + chapter line.
    const dialogText = screen.getByText(/purgeWarning/).props
      .children as string;

    // One novel selected: the warning must report count 1 (not 3 rows).
    // (Trailing ',' anchors the JSON so '"count":1' can't match 15.)
    expect(dialogText).toContain('"count":1,');
    // ...and the novel's downloaded chapters once (5, not 5 x 3 rows).
    expect(dialogText).toContain('chapterLinePresent:{"count":5}');
  });
});
