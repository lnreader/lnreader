import 'react-native-url-polyfill/auto';
import { enableFreeze } from 'react-native-screens';
import { PropsWithChildren, Suspense, useEffect, useMemo } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  MD3DarkTheme,
  MD3LightTheme,
  Provider as PaperProvider,
} from 'react-native-paper';

import AppErrorBoundary, {
  ErrorFallback,
} from '@components/AppErrorBoundary/AppErrorBoundary';

import Main from './src/navigators/Main';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useInitDatabase } from '@database/db';
import { useInitializeAppServices } from '@hooks/common/useInitializeAppServices';
import { opSqliteAdapter } from './src/rozenite/opSqliteAdapter';
import { useRozeniteSqlitePlugin } from '@rozenite/sqlite-plugin';
import { ThemeProvider, useTheme } from '@hooks/persisted/useTheme';
import { KeyboardProvider } from 'react-native-keyboard-controller';

enableFreeze(true);
const sqliteAdapters = __DEV__ && opSqliteAdapter ? [opSqliteAdapter] : [];

/**
 * The Android window background is resolved from the system light/dark setting,
 * so it is bright white whenever the system is light – regardless of the theme
 * picked inside the app. Nothing between it and the navigators paints a
 * background of its own, so every frame in which no screen is drawn (mounting a
 * nested navigator, freezing the screen being left) shows through as a flash.
 * Painting the root view keeps the window covered at all times.
 */
const ThemedRootView = ({ children }: PropsWithChildren) => {
  const theme = useTheme();

  return (
    <GestureHandlerRootView
      style={[styles.flex, { backgroundColor: theme.background }]}
    >
      {children}
    </GestureHandlerRootView>
  );
};

const ThemedPaperProvider = ({ children }: PropsWithChildren) => {
  const theme = useTheme();
  const paperTheme = useMemo(() => {
    const baseTheme = theme.isDark ? MD3DarkTheme : MD3LightTheme;

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        ...theme,
      },
    };
  }, [theme]);

  return <PaperProvider theme={paperTheme}>{children}</PaperProvider>;
};

const App = () => {
  useRozeniteSqlitePlugin({ adapters: sqliteAdapters });
  const { success: databaseReady, error: databaseError } = useInitDatabase();
  const { ready: servicesReady, error: servicesError } =
    useInitializeAppServices(Boolean(databaseReady));

  useEffect(() => {
    if ((databaseReady && servicesReady) || databaseError || servicesError) {
      SplashScreen.hideAsync();
    }
  }, [databaseReady, databaseError, servicesReady, servicesError]);

  const initializationError = databaseError || servicesError;

  if (initializationError) {
    return (
      <ThemeProvider>
        <ErrorFallback error={initializationError} resetError={() => null} />
      </ThemeProvider>
    );
  }

  if (!databaseReady || !servicesReady) {
    return null;
  }

  return (
    <Suspense fallback={null}>
<ThemeProvider>
        <ThemedRootView>
          <KeyboardProvider>
            <AppErrorBoundary>
              <SafeAreaProvider>
                <ThemedPaperProvider>
                  <BottomSheetModalProvider>
                    <StatusBar
                      translucent={true}
                      backgroundColor="transparent"
                    />
                    <Main />
                  </BottomSheetModalProvider>
                </ThemedPaperProvider>
              </SafeAreaProvider>
            </AppErrorBoundary>
          </KeyboardProvider>
        </ThemedRootView>
      </ThemeProvider>
    </Suspense>
  );
};

export default App;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
