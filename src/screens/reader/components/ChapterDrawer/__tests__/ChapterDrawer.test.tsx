import { fireEvent, render, screen, waitFor } from '@test-utils';
import {
  ChapterListViewCommands,
  createChapterListStore,
} from '@modules/nitro-chapter-list';
import ChapterDrawer from '..';

const mockUseNovelValue = jest.fn();
const mockUseNovelActions = jest.fn();
const mockUseChapterContext = jest.fn();
let mockAppSettings: Record<string, unknown> = {};

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelValue: (key: string) => mockUseNovelValue(key),
  useNovelActions: () => mockUseNovelActions(),
}));

jest.mock('@screens/reader/ChapterContext', () => ({
  useChapterContext: () => mockUseChapterContext(),
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    surface: '#111',
    outline: '#222',
    onSurface: '#333',
    onSurfaceVariant: '#444',
  }),
  useAppSettings: () => mockAppSettings,
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

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
  localization: 'en',
}));

jest.mock('@components/index', () => {
  const React = require('react');
  const { Pressable, Text, View } = require('react-native');

  return {
    Button: ({ title, onPress }: any) =>
      React.createElement(
        Pressable,
        { testID: `btn-${title}`, onPress },
        React.createElement(Text, null, title),
      ),
    LoadingScreenV2: () => React.createElement(View, { testID: 'loading' }),
  };
});

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: jest.fn(),
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

const makeChapter = (id: number, page = '1', overrides = {}) => ({
  id,
  novelId: 7,
  name: `Chapter ${id}`,
  path: `/chapter/${id}`,
  page,
  position: id,
  chapterNumber: id,
  unread: true,
  isDownloaded: false,
  bookmark: false,
  progress: 0,
  releaseTime: '2026-01-01',
  updatedTime: '2026-01-01',
  readTime: '2026-01-01',
  ...overrides,
});

const chapters = Array.from({ length: 10 }, (_, index) =>
  makeChapter(index + 1),
);

const createState = (overrides: Record<string, unknown> = {}) => ({
  chapters,
  novel: { id: 7 },
  novelSettings: { sort: 'positionAsc', filter: [] },
  pages: ['1', '2'],
  pageIndex: 0,
  fetching: false,
  batchInformation: { batch: 0, total: 3, totalChapters: 2500 },
  loadUpToBatch: jest.fn(() => Promise.resolve()),
  openPage: jest.fn(),
  ...overrides,
});

const setup = ({
  state = createState(),
  current = makeChapter(6),
}: {
  state?: ReturnType<typeof createState>;
  current?: ReturnType<typeof makeChapter>;
} = {}) => {
  const chapterContext = {
    chapter: current,
    getChapter: jest.fn(),
    setLoading: jest.fn(),
  };
  mockUseChapterContext.mockImplementation(() => chapterContext);
  mockUseNovelValue.mockImplementation((key: keyof typeof state) => state[key]);
  mockUseNovelActions.mockImplementation(() => ({
    loadUpToBatch: state.loadUpToBatch,
    openPage: state.openPage,
  }));
  const view = render(<ChapterDrawer />);
  return { view, state, chapterContext };
};

const list = () => screen.getByTestId('native-chapter-list');
const lastStore = () => {
  const { results } = (createChapterListStore as jest.Mock).mock;
  return results[results.length - 1].value;
};

describe('ChapterDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppSettings = { defaultChapterSort: 'positionAsc' };
  });

  it('shows the loading screen until chapters are loaded', () => {
    setup({ state: createState({ chapters: [] }) });

    expect(screen.getByTestId('loading')).toBeTruthy();
    expect(screen.queryByTestId('native-chapter-list')).toBeNull();
  });

  it('opens on the current chapter, highlighted, two rows below the top', () => {
    setup();

    expect(list().props.variant).toBe('drawer');
    expect(list().props.initialPosition).toBe(3);
    expect(lastStore().reset).toHaveBeenCalledWith(2500);
    expect(lastStore().setHighlighted).toHaveBeenCalledWith(6);
    expect(list().props.onScroll).toBeUndefined();
  });

  it('opens the pressed chapter', () => {
    const { chapterContext } = setup();

    fireEvent(list(), 'chapterPress', { nativeEvent: { id: 3, position: 2 } });

    expect(chapterContext.setLoading).toHaveBeenCalledWith(true);
    expect(chapterContext.getChapter).toHaveBeenCalledWith(chapters[2]);
  });

  it('opens the chapter page and loads the batches native asks for', async () => {
    const { state } = setup({ current: makeChapter(6, '2') });

    await waitFor(() => expect(state.openPage).toHaveBeenCalledWith(1));

    fireEvent(list(), 'requestRange', {
      nativeEvent: { start: 2000, end: 2499 },
    });

    expect(state.loadUpToBatch).toHaveBeenCalledWith(2);
  });

  it('replaces a footer button with "current chapter" when it scrolls out of view', () => {
    setup();

    expect(
      screen.getByTestId('btn-readerScreen.drawer.scrollToTop'),
    ).toBeTruthy();
    expect(
      screen.getByTestId('btn-readerScreen.drawer.scrollToBottom'),
    ).toBeTruthy();

    // Ascending: a current chapter below the visible rows replaces "bottom".
    fireEvent(list(), 'highlightedVisibilityChange', {
      nativeEvent: { state: 'below' },
    });
    expect(
      screen.getByTestId('btn-readerScreen.drawer.scrollToTop'),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByTestId('btn-readerScreen.drawer.scrollToCurrentChapter'),
    );
    expect(ChapterListViewCommands.scrollToIndex).toHaveBeenLastCalledWith(
      expect.anything(),
      3,
      true,
      0,
    );

    // Above it replaces "top".
    fireEvent(list(), 'highlightedVisibilityChange', {
      nativeEvent: { state: 'above' },
    });
    expect(
      screen.getByTestId('btn-readerScreen.drawer.scrollToBottom'),
    ).toBeTruthy();
    expect(
      screen.queryByTestId('btn-readerScreen.drawer.scrollToTop'),
    ).toBeNull();

    // Back in view, both buttons return; "bottom" scrolls to the end.
    fireEvent(list(), 'highlightedVisibilityChange', {
      nativeEvent: { state: 'visible' },
    });
    fireEvent.press(
      screen.getByTestId('btn-readerScreen.drawer.scrollToBottom'),
    );
    expect(ChapterListViewCommands.scrollToOffset).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.any(Number),
      true,
    );
    fireEvent.press(screen.getByTestId('btn-readerScreen.drawer.scrollToTop'));
    expect(ChapterListViewCommands.scrollToIndex).toHaveBeenLastCalledWith(
      expect.anything(),
      0,
      true,
      0,
    );
  });

  it('swaps the buttons for a descending list and honours reduced animations', () => {
    mockAppSettings = {
      defaultChapterSort: 'positionAsc',
      reduceAppAnimations: true,
    };
    setup({
      state: createState({
        novelSettings: { sort: 'positionDesc', filter: [] },
      }),
    });

    fireEvent(list(), 'highlightedVisibilityChange', {
      nativeEvent: { state: 'below' },
    });

    expect(
      screen.getByTestId('btn-readerScreen.drawer.scrollToBottom'),
    ).toBeTruthy();
    fireEvent.press(
      screen.getByTestId('btn-readerScreen.drawer.scrollToCurrentChapter'),
    );
    expect(ChapterListViewCommands.scrollToIndex).toHaveBeenLastCalledWith(
      expect.anything(),
      3,
      false,
      0,
    );
  });

  it('scrolls to and highlights a new current chapter', () => {
    const { view, state } = setup();

    mockUseChapterContext.mockImplementation(() => ({
      chapter: makeChapter(9),
      getChapter: jest.fn(),
      setLoading: jest.fn(),
    }));
    mockUseNovelValue.mockImplementation(
      (key: keyof typeof state) => state[key],
    );
    view.rerender(<ChapterDrawer />);

    expect(lastStore().setHighlighted).toHaveBeenLastCalledWith(9);
    expect(ChapterListViewCommands.scrollToIndex).toHaveBeenLastCalledWith(
      expect.anything(),
      6,
      true,
      0,
    );
  });

  it('syncs reading progress as row updates, never a reset', () => {
    const { view, state } = setup();
    const store = lastStore();
    expect(store.reset).toHaveBeenCalledTimes(1);

    // The novel store re-creates the chapter list on every progress write.
    const withProgress = chapters.map(chapter =>
      chapter.id === 6 ? { ...chapter, progress: 40 } : chapter,
    );
    const nextState = { ...state, chapters: withProgress };
    mockUseNovelValue.mockImplementation(
      (key: keyof typeof nextState) => nextState[key],
    );
    view.rerender(<ChapterDrawer />);

    expect(store.reset).toHaveBeenCalledTimes(1);
    expect(store.updateRows).toHaveBeenCalledTimes(1);
    expect(store.updateRows.mock.calls[0][0]).toEqual([
      expect.objectContaining({ id: 6, progress: 40 }),
    ]);
  });
});
