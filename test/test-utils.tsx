import { render } from '@testing-library/react-native';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ThemeProvider } from '@hooks/persisted/useTheme';

import AppErrorBoundary from '@components/AppErrorBoundary/AppErrorBoundary';
import { NovelContextProvider } from '@screens/novel/NovelContext';
import { NovelScreenProps, ChapterScreenProps } from '@navigators/types';

const AllTheProviders = ({ children }: { children: React.ReactElement }) => {
  return (
    <GestureHandlerRootView>
      <SafeAreaProvider>
        <ThemeProvider>
          <PaperProvider>
            <BottomSheetModalProvider>
              <AppErrorBoundary>{children}</AppErrorBoundary>
            </BottomSheetModalProvider>
          </PaperProvider>
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
