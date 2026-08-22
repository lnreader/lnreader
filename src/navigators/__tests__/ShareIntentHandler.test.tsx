import type { ReactNode } from 'react';
import { act, render, waitFor } from '@test-utils';
import NativeShareReceiver from '@modules/native-share-receiver';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import type { PluginItem } from '@plugins/types';
import ShareIntentHandler, {
  flushPendingShare,
  navigationRef,
} from '../ShareIntentHandler';

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({}),
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({}),
}));

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };

  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: ReactNode }) =>
      ReactModule.createElement(View, props, children),
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@plugins/pluginManager', () => ({
  INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(),
  setMMKVObject: jest.fn(),
}));

const testSource: PluginItem = {
  id: 'test-source',
  name: 'Test Source',
  site: 'https://testsource.example.com/',
  lang: 'English',
  version: '1.0.0',
  url: 'https://example.com/test-source.js',
  iconUrl: 'https://example.com/test-source.png',
};

const mockGetMMKVObject = getMMKVObject as jest.Mock;
const mockNavigate = navigationRef.navigate as jest.Mock;

const NOVEL_URL =
  'https://testsource.example.com/fiction/21220/mother-of-learning';

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMMKVObject.mockReturnValue([testSource]);
  (NativeShareReceiver.getInitialSharedText as jest.Mock).mockResolvedValue(
    null,
  );
  (navigationRef.isReady as jest.Mock).mockReturnValue(true);
});

describe('ShareIntentHandler', () => {
  it('navigates to the novel on an initial share matching a plugin', async () => {
    (NativeShareReceiver.getInitialSharedText as jest.Mock).mockResolvedValue(
      NOVEL_URL,
    );

    render(<ShareIntentHandler />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
        screen: 'Novel',
        params: {
          name: '',
          path: 'fiction/21220/mother-of-learning',
          pluginId: 'test-source',
          cover: null,
        },
      }),
    );
  });

  it('navigates to global search on an initial share matching no plugin', async () => {
    (NativeShareReceiver.getInitialSharedText as jest.Mock).mockResolvedValue(
      'https://www.someothersite.com/novel/1',
    );

    render(<ShareIntentHandler />);

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('GlobalSearchScreen', {
        searchText: 'https://www.someothersite.com/novel/1',
      }),
    );
  });

  it('does not navigate when the initial share is not a URL', async () => {
    (NativeShareReceiver.getInitialSharedText as jest.Mock).mockResolvedValue(
      'hello world',
    );

    render(<ShareIntentHandler />);
    // Let the initial-share promise settle before asserting no navigation.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('navigates on a warm share delivered through the SharedText event', async () => {
    render(<ShareIntentHandler />);

    const [eventName, listener] = (NativeShareReceiver.addListener as jest.Mock)
      .mock.calls[0];

    expect(eventName).toBe('SharedText');

    act(() => listener({ text: NOVEL_URL }));

    expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: 'fiction/21220/mother-of-learning',
        pluginId: 'test-source',
        cover: null,
      },
    });
  });

  it('queues the initial share until the container is ready', async () => {
    (NativeShareReceiver.getInitialSharedText as jest.Mock).mockResolvedValue(
      NOVEL_URL,
    );
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);

    render(<ShareIntentHandler />);
    // Let the initial-share promise settle while the container is not ready.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockNavigate).not.toHaveBeenCalled();

    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    act(() => flushPendingShare());

    expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: 'fiction/21220/mother-of-learning',
        pluginId: 'test-source',
        cover: null,
      },
    });
  });

  it('queues a warm share delivered before the container is ready', () => {
    (navigationRef.isReady as jest.Mock).mockReturnValue(false);

    render(<ShareIntentHandler />);

    const [eventName, listener] = (NativeShareReceiver.addListener as jest.Mock)
      .mock.calls[0];

    expect(eventName).toBe('SharedText');

    act(() => listener({ text: NOVEL_URL }));

    expect(mockNavigate).not.toHaveBeenCalled();

    (navigationRef.isReady as jest.Mock).mockReturnValue(true);
    act(() => flushPendingShare());

    expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: 'fiction/21220/mother-of-learning',
        pluginId: 'test-source',
        cover: null,
      },
    });
  });

  it('removes the SharedText listener on unmount', () => {
    const { unmount } = render(<ShareIntentHandler />);

    const subscription = (NativeShareReceiver.addListener as jest.Mock).mock
      .results[0].value;
    expect(subscription.remove).toBeDefined();

    unmount();

    expect(subscription.remove).toHaveBeenCalled();
  });
});
