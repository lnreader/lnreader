import 'react-native-url-polyfill/auto';
import { enableFreeze } from 'react-native-screens';

enableFreeze(true);

import React, { Suspense, useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LottieSplashScreen from 'react-native-lottie-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';

import AppErrorBoundary, {
  ErrorFallback,
} from '@components/AppErrorBoundary/AppErrorBoundary';

import Main from './src/navigators/Main';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useInitDatabase } from '@database/db';
import { useInitializeAppServices } from '@hooks/common/useInitializeAppServices';
import { ThemeProvider } from '@hooks/persisted/useTheme';

const App = () => {
  const { success: databaseReady, error: databaseError } = useInitDatabase();
  const { ready: servicesReady, error: servicesError } =
    useInitializeAppServices(Boolean(databaseReady));

  useEffect(() => {
    if ((databaseReady && servicesReady) || databaseError || servicesError) {
      LottieSplashScreen.hide();
    }
  }, [databaseReady, databaseError, servicesReady, servicesError]);

  const initializationError = databaseError || servicesError;

  if (initializationError) {
    return (
      <ErrorFallback error={initializationError} resetError={() => null} />
    );
  }

  if (!databaseReady || !servicesReady) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <GestureHandlerRootView style={styles.flex}>
        <AppErrorBoundary>
          <SafeAreaProvider>
            <ThemeProvider>
              <PaperProvider>
                <BottomSheetModalProvider>
                  <StatusBar translucent={true} backgroundColor="transparent" />
                  <Main />
                </BottomSheetModalProvider>
              </PaperProvider>
            </ThemeProvider>
          </SafeAreaProvider>
        </AppErrorBoundary>
      </GestureHandlerRootView>
    </Suspense>
  );
};

export default App;

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
