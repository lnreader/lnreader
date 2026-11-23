import type { ReactNode } from 'react';
import { render, screen, waitFor } from '@test-utils';
import { defaultTheme } from '@theme/md3/defaultTheme';
import type { ThemeColors } from '@theme/types';
import { PluginsTab } from '../PluginsTab';

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({ disableLoadingAnimations: true }),
  useFailedRepositoryCount: () => 0,
  useFilteredAvailablePlugins: () => [],
  useInstalledPlugins: () => [],
  usePluginActions: () => ({
    installPlugin: jest.fn(),
    refreshPlugins: jest.fn(),
    updatePlugin: jest.fn(),
  }),
  useTheme: () => ({}),
}));

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({}),
}));

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
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

jest.mock('@components', () => ({
  Button: () => null,
  EmptyView: () => null,
  IconButtonV2: () => null,
}));

const navigation = { navigate: jest.fn() } as never;

describe('PluginsTab', () => {
  it('shows a skeleton until the plugin list is mounted', async () => {
    render(
      <PluginsTab
        navigation={navigation}
        searchText=""
        theme={defaultTheme.light as ThemeColors}
      />,
    );

    expect(screen.getByTestId('plugins-skeleton')).toBeOnTheScreen();
    expect(screen.queryByTestId('fast-scrollbar-thumb')).not.toBeOnTheScreen();

    await waitFor(() =>
      expect(screen.queryByTestId('plugins-skeleton')).not.toBeOnTheScreen(),
    );
    expect(screen.getByTestId('fast-scrollbar-thumb')).toBeOnTheScreen();
  });
});
