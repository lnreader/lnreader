import type { ReactNode } from 'react';
import { act, renderHook } from '@test-utils';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import type { PluginItem } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import { useGlobalSearch } from '../useGlobalSearch';

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
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
  getPlugin: jest.fn(),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(),
  setMMKVObject: jest.fn(),
}));

jest.mock('@hooks/persisted', () => ({
  useFilteredInstalledPlugins: () => [testSource],
  useBrowseSettings: () => ({ globalSearchConcurrency: 1 }),
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
const mockGetPlugin = getPlugin as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMMKVObject.mockReturnValue([testSource]);
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useGlobalSearch', () => {
  it('does not search for a URL matching an installed plugin', () => {
    renderHook(() =>
      useGlobalSearch({
        defaultSearchText:
          'https://testsource.example.com/fiction/21220/mother-of-learning',
      }),
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(mockGetPlugin).not.toHaveBeenCalled();
  });

  it('does not search for a URL matching no plugin', () => {
    mockGetMMKVObject.mockReturnValue([]);

    renderHook(() =>
      useGlobalSearch({
        defaultSearchText: 'https://www.someothersite.com/novel/1',
      }),
    );

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(mockGetPlugin).not.toHaveBeenCalled();
  });

  it('searches when the search text is not a URL', async () => {
    renderHook(() =>
      useGlobalSearch({ defaultSearchText: 'mother of learning' }),
    );

    await act(async () => {
      jest.advanceTimersByTime(400);
      // Let the async per-plugin search chain settle inside act.
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
      }
    });

    expect(mockGetPlugin).toHaveBeenCalled();
  });

  it('does not search when the search text is empty', () => {
    renderHook(() => useGlobalSearch({ defaultSearchText: '' }));

    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(mockGetPlugin).not.toHaveBeenCalled();
  });
});
