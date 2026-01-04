import 'react-native-url-polyfill/auto';
import { enableFreeze } from 'react-native-screens';

enableFreeze(true);

import React, { Suspense, use, useEffect } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LottieSplashScreen from 'react-native-lottie-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';
import * as Notifications from 'expo-notifications';

import AppErrorBoundary, {
  ErrorFallback,
} from '@components/AppErrorBoundary/AppErrorBoundary';

import Main from './src/navigators/Main';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useInitDatabase } from '@database/db';

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

Notifications.setNotificationCategoryAsync('TTS_CONTROLS', [
  {
    identifier: 'TTS_PLAY_PAUSE',
    buttonTitle: '▶️ Play',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'TTS_STOP',
    buttonTitle: '⏹️ Stop',
    options: {
      opensAppToForeground: false,
    },
  },
  {
    identifier: 'TTS_NEXT',
    buttonTitle: '⏭️ Next',
    options: {
      opensAppToForeground: false,
    },
  },
]);

Notifications.setNotificationChannelAsync('tts-controls', {
  name: 'TTS Controls',
  description: 'Text-to-Speech playback controls',
  importance: Notifications.AndroidImportance.HIGH,
  vibrationPattern: [],
  enableLights: false,
  enableVibrate: false,
});

const App = () => {
  const state = useInitDatabase();

  useEffect(() => {
    if (state.success || state.error) {
      LottieSplashScreen.hide();
    }
  }, [state.success, state.error]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      response => {
        const actionIdentifier = response.actionIdentifier;
        if (actionIdentifier.startsWith('TTS_')) {
          const { setTTSAction } = require('@utils/ttsNotification');
          setTTSAction(actionIdentifier);
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, []);

  if (state.error) {
    return <ErrorFallback error={state.error} resetError={() => null} />;
  }

  return (
    <Suspense fallback={null}>
      <GestureHandlerRootView style={styles.flex}>
        <AppErrorBoundary>
          <SafeAreaProvider>
            <PaperProvider>
              <BottomSheetModalProvider>
                <StatusBar translucent={true} backgroundColor="transparent" />
                <Main />
              </BottomSheetModalProvider>
            </PaperProvider>
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
