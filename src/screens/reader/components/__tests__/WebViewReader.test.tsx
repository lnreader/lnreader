import React from 'react';
import { act, render } from '@test-utils';
import type { ChapterInfo, NovelInfo } from '@database/types';
import WebViewReader, { CHAPTER_SWAP_TIMEOUT_MS } from '../WebViewReader';

type WebViewProps = {
  source: { html: string; baseUrl?: string };
  onLoadEnd(): void;
  onMessage(event: { nativeEvent: { data: string } }): void;
};

const mockInjectJavaScript = jest.fn();
const mockWebView: { props?: WebViewProps } = {};

jest.mock('react-native-webview', () => {
  const ReactMock = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: ReactMock.forwardRef((props: WebViewProps, ref) => {
      ReactMock.useImperativeHandle(ref, () => ({
        injectJavaScript: mockInjectJavaScript,
      }));
      mockWebView.props = props;
      return null;
    }),
  };
});

jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => ({
  __esModule: true,
  default: class {
    addListener() {
      return { remove: jest.fn() };
    }
  },
}));

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

const mockTheme = {
  primary: '#6750a4',
  onPrimary: '#ffffff',
  secondary: '#625b71',
  tertiary: '#7d5260',
  onTertiary: '#ffffff',
  onSecondary: '#ffffff',
  surface: '#fffbfe',
  onSurface: '#1d1b20',
  surfaceVariant: '#e7e0ec',
  onSurfaceVariant: '#49454f',
  outline: '#79747e',
  outlineVariant: '#cac4d0',
  rippleColor: 'rgba(0,0,0,0.1)',
};

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
  useTheme: () => mockTheme,
}));

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({ reduceAppAnimations: false }),
  useTheme: () => mockTheme,
}));

const mockInstalledPlugins: { id: string; customJS?: string }[] = [];

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: (key: string) =>
    key === 'INSTALL_PLUGINS' ? mockInstalledPlugins : undefined,
  MMKVStorage: {
    addOnValueChangedListener: () => ({ remove: jest.fn() }),
  },
}));

jest.mock('@plugins/pluginManager', () => {
  const plugin = {
    id: 'demo',
    site: 'https://demo.example/',
    lang: 'English',
    imageRequestInit: { headers: {} },
  };
  return {
    INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
    getPlugin: () => plugin,
  };
});

jest.mock('../../hooks/useTtsSession', () => {
  const session = {
    command: jest.fn(),
    cancelSleepTimer: jest.fn(),
    loadQueue: jest.fn(),
    loadAndPlay: jest.fn(),
    progress: { index: 0, total: 0 },
    seekTo: jest.fn(),
    state: 'idle',
    setSleepTimer: jest.fn(),
    sleepTimer: { active: false, expired: false },
    updateSettings: jest.fn(),
  };
  return { useTtsSession: () => session };
});

jest.mock('../Hooks/useTextModifications', () => ({
  __esModule: true,
  default: (html: string) => ({
    html,
    pendingTextAction: null,
    replacementText: '',
    setReplacementText: jest.fn(),
    confirmTextAction: jest.fn(),
    dismissTextAction: jest.fn(),
    eventTextAction: jest.fn(),
  }),
}));

jest.mock('../../utils/sanitizeChapterText', () => ({
  isChapterRefreshUrl: () => false,
  isPluginIssueReportUrl: () => false,
}));

jest.mock('../../utils/ttsQueue', () => ({
  buildTtsQueueFromHtml: () => [],
}));

jest.mock('../TtsSleepTimerDialog', () => ({
  __esModule: true,
  default: () => null,
}));

const mockSaveProgress = jest.fn();
let mockContext: Record<string, unknown>;
jest.mock('../../ChapterContext', () => ({
  useChapterContext: () => mockContext,
}));

const novel = { id: 1, name: 'Novel', pluginId: 'demo' } as NovelInfo;
const webViewRef = { current: null };

const makeChapter = (id: number, isDownloaded = false) =>
  ({
    id,
    novelId: 1,
    name: `Chapter ${id}`,
    path: `/chapter-${id}`,
    progress: 0,
    isDownloaded,
  } as ChapterInfo);

const setContext = (chapter: ChapterInfo, chapterText: string) => {
  mockContext = {
    novel,
    chapter,
    documentChapter: chapter,
    chapterText,
    webViewRef,
    navigateChapter: jest.fn(),
    saveProgress: mockSaveProgress,
    activateChapter: jest.fn(),
    loadChapterAfter: jest.fn(),
    getRebuildTarget: () => undefined,
    dropChapters: jest.fn(),
    nextChapter: undefined,
    prevChapter: undefined,
    onUserInteraction: jest.fn(),
    isTTSReadingRef: { current: false },
    refetch: jest.fn(),
  };
};

// The shared providers wait for safe-area insets that never arrive in tests.
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

// Fresh props every time: the context is mocked, so `memo` would otherwise
// skip rendering the new chapter.
const ui = () => (
  <WebViewReader
    onPress={jest.fn()}
    onSearchResult={jest.fn()}
    searchTextRef={{ current: '' }}
  />
);

const post = (event: object) =>
  act(() => {
    mockWebView.props!.onMessage({
      nativeEvent: { data: JSON.stringify(event) },
    });
  });

const injected = () =>
  mockInjectJavaScript.mock.calls.map(([script]) => script as string);

const renderLoadedReader = (chapter = makeChapter(1)) => {
  setContext(chapter, '<p>First chapter</p>');
  const view = render(ui(), { wrapper: TestWrapper });
  act(() => mockWebView.props!.onLoadEnd());
  mockInjectJavaScript.mockClear();
  return view;
};

const goToChapter = (
  view: ReturnType<typeof render>,
  chapter: ChapterInfo,
  html: string,
) => {
  setContext(chapter, html);
  view.rerender(ui());
};

describe('WebViewReader chapter changes', () => {
  beforeEach(() => {
    mockInstalledPlugins.length = 0;
  });

  it('swaps the next chapter into the loaded page', () => {
    const view = renderLoadedReader();
    const source = mockWebView.props!.source;
    expect(source.html).toContain('First chapter');

    goToChapter(view, makeChapter(2), '<p>Second chapter</p>');

    expect(mockWebView.props!.source).toBe(source);
    const swap = injected().find(script =>
      script.includes('window.reader.setChapter('),
    );
    expect(swap).toContain('Second chapter');
    expect(swap).toContain('"id":2');
  });

  it('acts on chapter-shown only for the chapter on screen', () => {
    const view = renderLoadedReader();
    goToChapter(view, makeChapter(2), '<p>Second chapter</p>');
    goToChapter(view, makeChapter(3), '<p>Third chapter</p>');
    mockInjectJavaScript.mockClear();

    post({ type: 'chapter-shown', chapterId: 2 });
    expect(injected()).toEqual([]);

    post({ type: 'chapter-shown', chapterId: 3 });
    expect(mockInjectJavaScript).toHaveBeenCalledTimes(1);
    expect(injected()[0]).toContain('reader.batteryLevel.val');
    expect(injected()[0]).toContain('setAdjacentChapters');
    expect(injected()[0]).toContain('setPlaybackState');
  });

  it('saves progress to the chapter the page names', () => {
    renderLoadedReader();

    post({ type: 'save', data: 90, chapterId: 1 });
    expect(mockSaveProgress).toHaveBeenCalledWith(90, 1);
  });

  it('reloads the page for plugins that ship custom.js', () => {
    mockInstalledPlugins.push({ id: 'demo', customJS: 'https://x/c.js' });
    const view = renderLoadedReader();
    const source = mockWebView.props!.source;

    goToChapter(view, makeChapter(2), '<p>Second chapter</p>');

    expect(mockWebView.props!.source).not.toBe(source);
    expect(mockWebView.props!.source.html).toContain('Second chapter');
    expect(injected().some(s => s.includes('setChapter('))).toBe(false);
  });

  it('reloads the page when the downloaded state changes', () => {
    const view = renderLoadedReader(makeChapter(1, true));
    expect(mockWebView.props!.source.baseUrl).toBeUndefined();

    goToChapter(view, makeChapter(2, false), '<p>Second chapter</p>');

    expect(mockWebView.props!.source.html).toContain('Second chapter');
    expect(mockWebView.props!.source.baseUrl).toBe('https://demo.example/');
  });

  it('reloads the page when the page reports a failed swap', () => {
    const view = renderLoadedReader();
    const source = mockWebView.props!.source;
    goToChapter(view, makeChapter(2), '<p>Second chapter</p>');

    post({ type: 'chapter-swap-failed', chapterId: 2 });

    expect(mockWebView.props!.source).not.toBe(source);
    expect(mockWebView.props!.source.html).toContain('Second chapter');
  });

  it('reloads the page when a swap is never confirmed', () => {
    jest.useFakeTimers();
    try {
      const view = renderLoadedReader();
      const source = mockWebView.props!.source;
      goToChapter(view, makeChapter(2), '<p>Second chapter</p>');

      act(() => jest.advanceTimersByTime(CHAPTER_SWAP_TIMEOUT_MS));

      expect(mockWebView.props!.source).not.toBe(source);
      expect(mockWebView.props!.source.html).toContain('Second chapter');
    } finally {
      jest.useRealTimers();
    }
  });

  it('reloads when the chapter changes before the page has loaded', () => {
    setContext(makeChapter(1), '<p>First chapter</p>');
    const view = render(ui(), { wrapper: TestWrapper });
    const source = mockWebView.props!.source;

    goToChapter(view, makeChapter(2), '<p>Second chapter</p>');

    expect(mockWebView.props!.source).not.toBe(source);
    expect(mockWebView.props!.source.html).toContain('Second chapter');
  });

  it('keeps the page when infinite scrolling makes another chapter current', () => {
    const view = renderLoadedReader();
    const source = mockWebView.props!.source;

    mockContext = { ...mockContext, chapter: makeChapter(2) };
    view.rerender(ui());

    expect(mockWebView.props!.source).toBe(source);
    expect(injected().some(s => s.includes('setChapter('))).toBe(false);
  });

  it('rebuilds the page from the chapter being read at its live progress', () => {
    const view = renderLoadedReader();
    const source = mockWebView.props!.source;
    const active = { ...makeChapter(3), progress: 40 };

    // Plugins that ship custom.js make any chapter change load a new page.
    mockInstalledPlugins.push({ id: 'demo', customJS: 'https://x/c.js' });
    goToChapter(view, makeChapter(2), '<p>Second chapter</p>');
    mockContext = {
      ...mockContext,
      getRebuildTarget: () => ({
        chapter: active,
        html: '<p>Third chapter</p>',
      }),
    };
    post({ type: 'chapter-swap-failed', chapterId: 2 });
    view.rerender(ui());

    const rebuilt = mockWebView.props!.source;
    expect(rebuilt).not.toBe(source);
    expect(rebuilt.html).toContain('Third chapter');
    expect(rebuilt.html).toContain('"progress":40');
    expect(rebuilt.html).not.toContain('Second chapter');
  });
});
