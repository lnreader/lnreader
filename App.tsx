import 'react-native-url-polyfill/auto';
import { enableFreeze } from 'react-native-screens';

enableFreeze(true);

import React, { Suspense, useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';

import AppErrorBoundary, {
  ErrorFallback,
} from '@components/AppErrorBoundary/AppErrorBoundary';

import Main from './src/navigators/Main';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useInitDatabase } from '@database/db';
import { ThemeProvider } from '@hooks/persisted/useTheme';

Notifications.setNotificationHandler({
  handleNotification: async () => {
    return {
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

const App = () => {
  const state = useInitDatabase();

  useEffect(() => {
    if (state.success || state.error) {
      SplashScreen.hideAsync();
    }
  }, [state.success, state.error]);

  if (state.error) {
    return <ErrorFallback error={state.error} resetError={() => null} />;
  }

  if (!state.success) {
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
