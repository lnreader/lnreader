import { act, renderHook, waitFor } from '@testing-library/react-native';

import NativeFile from '@modules/native-file';
import {
  initialChapterGeneralSettings,
  initialChapterReaderSettings,
} from '@hooks/persisted/useSettings';
import type {
  NativeToWebMessage,
  WebToNativeMessage,
} from '../../engine/protocol';
import { MMKVStorage } from '@utils/mmkv/mmkv';
import { readPosition, writePosition } from '../../utils/positions';
import useChapter from '../useChapter';

const mockNovelActions = jest.fn();
const mockReaderSettings = jest.fn();
const mockGeneralSettings = jest.fn();
const mockLibrarySettings = jest.fn();
const mockGetReaderChapters = jest.fn();
const mockGetChapterCount = jest.fn();
const mockInsertChapters = jest.fn();
const mockInsertHistory = jest.fn();
const mockGetDbChapter = jest.fn();
const mockFetchChapter = jest.fn();
const mockFetchPage = jest.fn();
const mockLoadAndPlay = jest.fn();
const mockTtsCommand = jest.fn();
const mockTtsState = jest.fn(() => 'idle');
const mockSetImmersive = jest.fn();
const mockShowBars = jest.fn();
const mockUpdateTracked = jest.fn();

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelActions: () => mockNovelActions(),
  useNovelValue: () => undefined,
}));

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({ timeTrackingEnabled: false }),
  useChapterGeneralSettings: () => mockGeneralSettings(),
  useChapterReaderSettings: () => mockReaderSettings(),
  useLibrarySettings: () => mockLibrarySettings(),
  useTheme: () => ({
    primary: '#6750a4',
    onPrimary: '#ffffff',
    secondary: '#625b71',
    tertiary: '#7d5260',
    onTertiary: '#ffffff',
    onSecondary: '#ffffff',
    surface: '#fffbfe',
    onSurface: '#1c1b1f',
    surfaceVariant: '#e7e0ec',
    onSurfaceVariant: '#49454f',
    outline: '#79747e',
    outlineVariant: '#cac4d0',
    rippleColor: '#6750a41f',
  }),
  useTracker: () => ({ tracker: { id: 'anilist' } }),
  useTrackedNovel: () => ({
    trackedNovel: { progress: 0 },
    updateAllTrackedNovels: mockUpdateTracked,
  }),
}));

jest.mock('@hooks', () => ({
  useFullscreenMode: () => ({
    setImmersiveMode: mockSetImmersive,
    showStatusAndNavBar: mockShowBars,
  }),
}));

jest.mock('@database/queries/ReaderQueries', () => ({
  getReaderChapters: (...args: unknown[]) => mockGetReaderChapters(...args),
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getChapter: (...args: unknown[]) => mockGetDbChapter(...args),
  getChapterCount: (...args: unknown[]) => mockGetChapterCount(...args),
  insertChapters: (...args: unknown[]) => mockInsertChapters(...args),
}));

jest.mock('@database/queries/HistoryQueries', () => ({
  insertHistory: (...args: unknown[]) => mockInsertHistory(...args),
}));

jest.mock('@services/plugin/fetch', () => ({
  fetchChapter: (...args: unknown[]) => mockFetchChapter(...args),
  fetchPage: (...args: unknown[]) => mockFetchPage(...args),
}));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: () => ({ site: 'https://novels.example/', lang: 'English' }),
}));

jest.mock('../../utils/sanitizeChapterText', () => ({
  sanitizeChapterText: (_p: string, _n: string, _c: string, text: string) =>
    `<p>${text}</p>`,
}));

jest.mock('@utils/runWhenIdle', () => ({
  runWhenIdle: (task: () => void) => {
    task();
    return () => undefined;
  },
}));

jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));

jest.mock('../useTimeTracking', () => ({
  __esModule: true,
  default: () => ({
    onUserInteraction: jest.fn(),
    isTTSReadingRef: { current: false },
  }),
}));

jest.mock('../useTtsSession', () => ({
  useTtsSession: () => ({
    command: mockTtsCommand,
    loadAndPlay: mockLoadAndPlay,
    progress: { index: 0, total: 0, paragraphId: '' },
    state: mockTtsState(),
    error: null,
    updateSettings: jest.fn(),
    seekTo: jest.fn(),
  }),
}));

jest.mock('expo', () => ({ useEventListener: jest.fn() }));

const chapter = (id: number, extra: Record<string, unknown> = {}) => ({
  id,
  novelId: 7,
  name: `Chapter ${id}`,
  path: `/chapter/${id}`,
  page: '1',
  position: id,
  unread: true,
  isDownloaded: false,
  bookmark: false,
  progress: 0,
  releaseTime: null,
  updatedTime: null,
  readTime: null,
  timeSpent: 0,
  ...extra,
});

const novel = {
  id: 7,
  pluginId: 'plugin.reader',
  path: '/novel/test',
  name: 'Novel Test',
  totalPages: 2,
  inLibrary: true,
  cover: null,
} as unknown as Parameters<typeof useChapter>[1];

const createCache = () => {
  const cache = new Map<number, string | Promise<string>>();
  return {
    read: jest.fn((id: number) => cache.get(id)),
    write: jest.fn((id: number, value: string | Promise<string>) => {
      cache.set(id, value);
    }),
    remove: jest.fn((id: number) => {
      cache.delete(id);
    }),
    clear: jest.fn(() => cache.clear()),
  };
};

const setup = (options: { incognito?: boolean; start?: number } = {}) => {
  const injected: NativeToWebMessage[] = [];
  const webView = {
    current: {
      injectJavaScript: jest.fn((script: string) => {
        const json = script.slice(
          script.indexOf('receive(') + 'receive('.length,
          script.lastIndexOf(');true;'),
        );
        injected.push(JSON.parse(json) as NativeToWebMessage);
      }),
    },
  };
  mockLibrarySettings.mockReturnValue({ incognitoMode: !!options.incognito });
  const book = [chapter(1), chapter(2), chapter(3)];
  const view = renderHook(() =>
    useChapter(
      webView as never,
      novel,
      book[(options.start ?? 1) - 1] as never,
    ),
  );
  const post = (message: WebToNativeMessage | string) =>
    act(() => {
      view.result.current.webView.onMessage({
        nativeEvent: {
          data: typeof message === 'string' ? message : JSON.stringify(message),
        },
      } as never);
    });
  const sent = <T extends NativeToWebMessage['type']>(type: T) =>
    injected.filter(message => message.type === type) as Extract<
      NativeToWebMessage,
      { type: T }
    >[];
  return { ...view, book, post, sent, injected };
};

const flush = () =>
  act(async () => {
    await new Promise(resolve => setTimeout(resolve, 0));
  });

describe('useChapter', () => {
  let cache: ReturnType<typeof createCache>;
  let actions: Record<string, jest.Mock | ReturnType<typeof createCache>>;
  let reader: Record<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTtsState.mockReturnValue('idle');
    // Saved positions live in MMKV, which persists between tests.
    MMKVStorage.clearAll();
    cache = createCache();
    actions = {
      setLastRead: jest.fn(),
      markChapterRead: jest.fn(),
      updateChapterProgress: jest.fn(),
      increaseTimeSpent: jest.fn(),
      chapterTextCache: cache,
    };
    mockNovelActions.mockReturnValue(actions);
    reader = {
      ...initialChapterReaderSettings,
      removeText: ['[ads]'],
      replaceText: { colour: 'color' },
      setChapterReaderSettings: jest.fn(),
    };
    mockReaderSettings.mockReturnValue(reader);
    mockGeneralSettings.mockReturnValue({
      ...initialChapterGeneralSettings,
      setChapterGeneralSettings: jest.fn(),
    });
    mockGetReaderChapters.mockResolvedValue([
      chapter(1),
      chapter(2),
      chapter(3),
    ]);
    mockGetDbChapter.mockImplementation(async (id: number) => chapter(id));
    (NativeFile.readFile as jest.Mock).mockRejectedValue(new Error('missing'));
    mockFetchChapter.mockResolvedValue('online text [ads] colour');
  });

  it('opens the whole novel as a book once the page is ready', async () => {
    const { post, sent } = setup({ start: 2 });
    await flush();
    post({ type: 'ready' });
    await waitFor(() => expect(sent('open')).toHaveLength(1));
    const open = sent('open')[0];
    expect(open.sections.map(section => section.id)).toEqual([1, 2, 3]);
    expect(open.start).toEqual({ chapterId: 2, fraction: 0 });
    expect(open.novelId).toBe(7);
    expect(open.pluginId).toBe('plugin.reader');
    expect(open.preferences.cssVariables['theme-primary']).toBe('#6750a4');
  });

  it('reopens a chapter at its saved position', async () => {
    writePosition(1, 0.42);
    const { post, sent } = setup();
    await flush();
    post({ type: 'ready' });
    await waitFor(() => expect(sent('open')).toHaveLength(1));
    expect(sent('open')[0].start.fraction).toBe(0.42);
  });

  it('serves online chapters with text rules applied and the site as base', async () => {
    const { post, sent } = setup();
    await flush();
    post({ type: 'request-section', requestId: 5, chapterId: 1 });
    await waitFor(() => expect(sent('section-content')).toHaveLength(1));
    const content = sent('section-content')[0];
    expect(content.requestId).toBe(5);
    expect(content.html).toBe('<p>online text  color</p>');
    expect(content.baseUrl).toBe('https://novels.example/');
    post({ type: 'request-section', requestId: 6, chapterId: 1 });
    await waitFor(() => expect(sent('section-content')).toHaveLength(2));
    expect(mockFetchChapter).toHaveBeenCalledTimes(1);
  });

  it('serves downloaded chapters from storage without a base URL', async () => {
    mockGetReaderChapters.mockResolvedValue([
      chapter(1, { isDownloaded: true }),
    ]);
    (NativeFile.readFile as jest.Mock).mockResolvedValue('stored text');
    const { post, sent } = setup();
    await flush();
    post({ type: 'request-section', requestId: 1, chapterId: 1 });
    await waitFor(() => expect(sent('section-content')).toHaveLength(1));
    expect(sent('section-content')[0].html).toBe('<p>stored text</p>');
    expect(sent('section-content')[0].baseUrl).toBeUndefined();
    expect(mockFetchChapter).not.toHaveBeenCalled();
  });

  it('reports failures and forgets them so a retry fetches again', async () => {
    mockFetchChapter.mockRejectedValueOnce(new Error('offline'));
    const { post, sent } = setup();
    await flush();
    post({ type: 'request-section', requestId: 1, chapterId: 1 });
    await waitFor(() => expect(sent('section-error')).toHaveLength(1));
    expect(sent('section-error')[0].message).toBe('offline');
    expect(cache.remove).toHaveBeenCalledWith(1);
    post({ type: 'refresh-section', chapterId: 1 });
    expect(sent('reload-section')).toEqual([
      { type: 'reload-section', chapterId: 1 },
    ]);
  });

  it('saves progress, the position and marks a finished chapter read once', async () => {
    jest.useFakeTimers();
    try {
      const { post, result } = setup();
      await act(async () => {
        await Promise.resolve();
      });
      const relocate = (fraction: number, endFraction: number, chapterId = 1) =>
        post({
          type: 'relocate',
          chapterId,
          fraction,
          endFraction,
          atStart: false,
          atEnd: false,
        });
      await waitFor(() =>
        expect(result.current.session.chapters).toHaveLength(3),
      );
      relocate(0.5, 0.6);
      expect(result.current.session.position?.fraction).toBe(0.5);
      expect(readPosition(1)).toBe(0.5);
      act(() => {
        jest.advanceTimersByTime(2500);
      });
      expect(actions.updateChapterProgress).toHaveBeenLastCalledWith(1, 60);
      relocate(0.9, 1);
      relocate(0.95, 1);
      expect(actions.markChapterRead).toHaveBeenCalledTimes(1);
      expect(actions.markChapterRead).toHaveBeenCalledWith(1);
      expect(mockUpdateTracked).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('follows the chapter on screen and counts the one left behind as read', async () => {
    mockGeneralSettings.mockReturnValue({
      ...initialChapterGeneralSettings,
      continuousChapters: true,
      setChapterGeneralSettings: jest.fn(),
    });
    const { post, result } = setup();
    await waitFor(() =>
      expect(result.current.session.chapters).toHaveLength(3),
    );
    post({
      type: 'relocate',
      chapterId: 1,
      fraction: 0.8,
      endFraction: 0.92,
      atStart: false,
      atEnd: false,
    });
    post({
      type: 'relocate',
      chapterId: 2,
      fraction: 0,
      endFraction: 0.1,
      atStart: false,
      atEnd: false,
    });
    expect(result.current.session.chapter.id).toBe(2);
    expect(result.current.session.prevChapter?.id).toBe(1);
    expect(result.current.session.nextChapter?.id).toBe(3);
    expect(actions.markChapterRead).toHaveBeenCalledWith(1);
    await waitFor(() => expect(mockInsertHistory).toHaveBeenCalledWith(2));
  });

  it('a finished read-aloud queue advances one chapter only', async () => {
    mockReaderSettings.mockReturnValue({
      ...initialChapterReaderSettings,
      tts: { ...initialChapterReaderSettings.tts, autoPageAdvance: true },
      setChapterReaderSettings: jest.fn(),
    });
    const { post, result, rerender, sent } = setup();
    await waitFor(() =>
      expect(result.current.session.chapters).toHaveLength(3),
    );
    mockTtsState.mockReturnValue('completed');
    rerender({});
    expect(sent('go-to').map(m => m.location.chapterId)).toEqual([2]);
    // The next chapter comes on screen while the queue still reads completed.
    post({
      type: 'relocate',
      chapterId: 2,
      fraction: 0,
      endFraction: 0.1,
      atStart: true,
      atEnd: false,
    });
    rerender({});
    expect(sent('go-to').map(m => m.location.chapterId)).toEqual([2]);
  });

  it('one chapter at a time, a chapter counts as read from 97% only', async () => {
    mockGeneralSettings.mockReturnValue({
      ...initialChapterGeneralSettings,
      continuousChapters: false,
      setChapterGeneralSettings: jest.fn(),
    });
    const { post, result } = setup();
    await waitFor(() =>
      expect(result.current.session.chapters).toHaveLength(3),
    );
    post({
      type: 'relocate',
      chapterId: 1,
      fraction: 0.8,
      endFraction: 0.92,
      atStart: false,
      atEnd: false,
    });
    post({
      type: 'relocate',
      chapterId: 2,
      fraction: 0,
      endFraction: 0.1,
      atStart: false,
      atEnd: false,
    });
    expect(result.current.session.chapter.id).toBe(2);
    expect(actions.markChapterRead).not.toHaveBeenCalled();
  });

  it('with pages, progress is only saved as it grows', async () => {
    const { post, result } = setup();
    await waitFor(() =>
      expect(result.current.session.chapters).toHaveLength(3),
    );
    const page = (endFraction: number) =>
      post({
        type: 'relocate',
        chapterId: 1,
        fraction: endFraction - 0.25,
        endFraction,
        page: Math.round(endFraction * 4),
        pages: 4,
        atStart: false,
        atEnd: false,
      });
    page(0.5);
    page(0.25);
    expect(actions.updateChapterProgress).toHaveBeenCalledTimes(1);
    expect(actions.updateChapterProgress).toHaveBeenLastCalledWith(1, 50);
    page(0.75);
    expect(actions.updateChapterProgress).toHaveBeenLastCalledWith(1, 75);
  });

  it('records nothing in incognito mode', async () => {
    jest.useFakeTimers();
    try {
      const { post, result } = setup({ incognito: true });
      await act(async () => {
        await Promise.resolve();
      });
      await waitFor(() =>
        expect(result.current.session.chapters).toHaveLength(3),
      );
      post({
        type: 'relocate',
        chapterId: 1,
        fraction: 0.3,
        endFraction: 1,
        atStart: false,
        atEnd: true,
      });
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(actions.updateChapterProgress).not.toHaveBeenCalled();
      expect(actions.markChapterRead).not.toHaveBeenCalled();
      expect(readPosition(1)).toBeUndefined();
      expect(mockInsertHistory).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('fetches the next source page when the book runs out', async () => {
    mockGetChapterCount.mockResolvedValue(0);
    mockFetchPage.mockResolvedValue({
      chapters: [{ name: 'Chapter 4', path: '/chapter/4' }],
    });
    const { post, sent, result } = setup();
    await waitFor(() =>
      expect(result.current.session.chapters).toHaveLength(3),
    );
    mockGetReaderChapters.mockResolvedValue([
      chapter(1),
      chapter(2),
      chapter(3),
      chapter(4, { page: '2' }),
    ]);
    post({ type: 'boundary', direction: 'next' });
    await waitFor(() => expect(sent('append-sections')).toHaveLength(1));
    expect(mockFetchPage).toHaveBeenCalledWith(
      'plugin.reader',
      '/novel/test',
      '2',
    );
    expect(mockInsertChapters).toHaveBeenCalledWith(7, [
      { name: 'Chapter 4', path: '/chapter/4', page: '2' },
    ]);
    expect(sent('append-sections')[0].sections).toEqual([
      { id: 4, name: 'Chapter 4' },
    ]);
    expect(sent('turn')).toEqual([{ type: 'turn', direction: 'next' }]);
  });

  it('toggles the controls on a tap', async () => {
    const { post, result } = setup();
    expect(result.current.hidden).toBe(true);
    post({ type: 'tap' });
    expect(result.current.hidden).toBe(false);
    expect(mockShowBars).toHaveBeenCalled();
    post({ type: 'tap' });
    expect(result.current.hidden).toBe(true);
    expect(mockSetImmersive).toHaveBeenCalled();
  });

  it('accepts search results only for the current query', async () => {
    const { post, result, sent } = setup();
    act(() => result.current.session.search.run('needle'));
    expect(sent('search')).toEqual([{ type: 'search', query: 'needle' }]);
    post({ type: 'search-result', query: 'old', current: 1, total: 3 });
    expect(result.current.session.search.result.total).toBe(0);
    post({ type: 'search-result', query: 'needle', current: 2, total: 5 });
    expect(result.current.session.search.result).toMatchObject({
      current: 2,
      total: 5,
    });
  });

  it('speaks the queue the page builds', async () => {
    const { post, result } = setup();
    await waitFor(() =>
      expect(result.current.session.chapters).toHaveLength(3),
    );
    post({ type: 'tts-queue', chapterId: 1, utterances: ['One.', 'Two.'] });
    expect(mockLoadAndPlay).toHaveBeenCalledWith(
      ['One.', 'Two.'],
      0,
      expect.objectContaining({
        novelName: 'Novel Test',
        chapterName: 'Chapter 1',
      }),
      expect.any(Object),
    );
  });

  it('keeps removed and replaced text as rules and edits the page', async () => {
    const { result, sent } = setup();
    act(() => result.current.session.selection.remove('bad'));
    expect(reader.setChapterReaderSettings).toHaveBeenCalledWith({
      removeText: ['[ads]', 'bad'],
    });
    expect(sent('text-edit')).toEqual([
      { type: 'text-edit', action: 'remove', text: 'bad' },
    ]);
  });

  it('ignores malformed messages', () => {
    const { post, injected } = setup();
    post('not json');
    post(JSON.stringify({ type: 'wipe-everything' }));
    expect(injected).toHaveLength(0);
  });
});
