import { render } from '@testing-library/react-native';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from '@hooks/persisted/useTheme';

import AppErrorBoundary from '@components/AppErrorBoundary/AppErrorBoundary';
import type { NovelContextProvider as NovelContextProviderType } from '@screens/novel/NovelContext';
import { NovelScreenProps, ChapterScreenProps } from '@navigators/types';

// Without metrics the provider renders nothing until a native layout pass.
const TEST_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const AllTheProviders = ({ children }: { children: React.ReactElement }) => {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider initialMetrics={TEST_METRICS}>
        <ThemeProvider>
          <AppErrorBoundary>{children}</AppErrorBoundary>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const customRender = (ui: React.ReactElement, options?: object) =>
  render(ui, { wrapper: AllTheProviders, ...options });

const renderNovel = (
  ui: React.ReactElement,
  options?: {
    route?: NovelScreenProps['route'] | ChapterScreenProps['route'];
  },
) => {
  const { route } = options || {};
  // Required lazily: the novel context pulls in the database layer, which
  // only tests that render novels mock.
  const { NovelContextProvider } = require('@screens/novel/NovelContext') as {
    NovelContextProvider: typeof NovelContextProviderType;
  };
  return render(
    <NovelContextProvider
      route={route as NovelScreenProps['route'] | ChapterScreenProps['route']}
    >
      {ui}
    </NovelContextProvider>,
    { wrapper: AllTheProviders, ...options },
  );
};

export * from '@testing-library/react-native';

export { customRender as render, renderNovel, AllTheProviders };
