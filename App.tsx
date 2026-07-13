import 'react-native-url-polyfill/auto';
import { enableFreeze } from 'react-native-screens';

enableFreeze(true);

import React, { Suspense, useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LottieSplashScreen from 'react-native-lottie-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';
import { KeyboardProvider } from 'react-native-keyboard-controller';

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
      LottieSplashScreen.hide();
    }
  }, [state.success, state.error]);

  if (state.error) {
    return <ErrorFallback error={state.error} resetError={() => null} />;
  }

  return (
    <Suspense fallback={null}>
      <GestureHandlerRootView style={styles.flex}>
        <ThemeProvider>
          <AppErrorBoundary>
            <SafeAreaProvider>
              <KeyboardProvider>
                <PaperProvider>
                  <BottomSheetModalProvider>
                    <StatusBar
                      translucent={true}
                      backgroundColor="transparent"
                    />
                    <Main />
                  </BottomSheetModalProvider>
                </PaperProvider>
              </KeyboardProvider>
            </SafeAreaProvider>
          </AppErrorBoundary>
        </ThemeProvider>
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
