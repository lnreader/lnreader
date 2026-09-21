import { lazy, Suspense, useEffect } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  setNavigationBarTransparent,
  setStatusBarColor,
} from '@theme/utils/setBarColor';
import { useAppSettings, usePluginActions, useTheme } from '@hooks/persisted';
import { AppUpdateChecker } from '@components';

/**
 * The tab navigator is the first thing drawn, so it is the only route linked
 * into the startup bundle. Every other route is pulled in through
 * `getComponent`, which defers its `require` – and the modules it drags in,
 * from the WebView to the syntax highlighter – until it is first navigated to.
 */
import BottomNavigator from './BottomNavigator';

import { RootStackParamList } from './types';
import { useMMKVBoolean } from 'react-native-mmkv';
import { backgroundTasks } from '@services/backgroundTasks';
import ShareIntentHandler, {
  flushPendingShare,
  navigationRef,
} from './ShareIntentHandler';
import { LibraryContextProvider } from '@components/Context/LibraryContext';
import { UpdateContextProvider } from '@components/Context/UpdateContext';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';
const Stack = createNativeStackNavigator<RootStackParamList>();

// Onboarding is shown once, but it reaches most of the browse stack, so it is
// kept out of the bundle every later launch has to evaluate.
const OnboardingScreen = lazy(
  () => import('@screens/onboarding/OnboardingScreen'),
);

const MainNavigator = () => {
  const theme = useTheme();
  const { updateLibraryOnLaunch } = useAppSettings();
  const { refreshPlugins } = usePluginActions();
  const [isOnboarded] = useMMKVBoolean('IS_ONBOARDED');

  useEffect(() => {
    const timer = setTimeout(async () => {
      setStatusBarColor(theme);
      setNavigationBarTransparent(theme.isDark);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [theme]);

  useEffect(() => {
    if (updateLibraryOnLaunch) {
      backgroundTasks.enqueue({ name: 'UPDATE_LIBRARY' });
    }
    if (isOnboarded) {
      // hack this helps app has enough time to initialize database;
      refreshPlugins();
    }
  }, [isOnboarded, refreshPlugins, updateLibraryOnLaunch]);

  // Enable React Navigation DevTools in development
  useReactNavigationDevTools({ ref: navigationRef });

  if (!isOnboarded) {
    return (
      <Suspense fallback={null}>
        <OnboardingScreen />
      </Suspense>
    );
  }
  return (
    <NavigationContainer<RootStackParamList>
      ref={navigationRef}
      onReady={flushPendingShare}
      theme={{
        colors: {
          ...DefaultTheme.colors,
          primary: theme.primary,
          background: theme.background,
          card: theme.surface,
          text: theme.onSurface,
          border: theme.outline,
        },
        dark: theme.isDark,
        fonts: DefaultTheme.fonts,
      }}
      linking={{
        prefixes: ['lnreader://'],
        config: {
          screens: {
            MoreStack: {
              screens: {
                SettingsStack: {
                  screens: {
                    RespositorySettings: '/repo/add',
                  },
                },
              },
            },
          },
        },
      }}
    >
      <ShareIntentHandler />
      <LibraryContextProvider>
        <UpdateContextProvider>
          <AppUpdateChecker />
          <Stack.Navigator
            screenOptions={{
              animation: 'none',
              contentStyle: { backgroundColor: theme.background },
              headerShown: false,
            }}
          >
            <Stack.Screen name="BottomNavigator" component={BottomNavigator} />
            <Stack.Screen
              name="ReaderStack"
              getComponent={() => require('./ReaderStack').default}
            />
            <Stack.Screen
              name="MoreStack"
              getComponent={() => require('./MoreStack').default}
            />
            <Stack.Screen
              name="SourceScreen"
              getComponent={() =>
                require('../screens/BrowseSourceScreen/BrowseSourceScreen')
                  .default
              }
            />
            <Stack.Screen
              name="BrowseMal"
              getComponent={() =>
                require('../screens/browse/discover/MalTopNovels').default
              }
            />
            <Stack.Screen
              name="BrowseAL"
              getComponent={() =>
                require('../screens/browse/discover/AniListTopNovels').default
              }
            />
            <Stack.Screen
              name="BrowseSettings"
              getComponent={() =>
                require('../screens/browse/settings/BrowseSettings').default
              }
            />
            <Stack.Screen
              name="PluginDetails"
              getComponent={() =>
                require('../screens/browse/PluginDetailsScreen').default
              }
            />
            <Stack.Screen
              name="GlobalSearchScreen"
              getComponent={() =>
                require('../screens/GlobalSearchScreen/GlobalSearchScreen')
                  .default
              }
            />
            <Stack.Screen
              name="Migration"
              getComponent={() =>
                require('../screens/browse/migration/Migration').default
              }
            />
            <Stack.Screen
              name="SourceNovels"
              getComponent={() =>
                require('../screens/browse/SourceNovels').default
              }
            />
            <Stack.Screen
              name="MigrateNovel"
              getComponent={() =>
                require('../screens/browse/migration/MigrationNovels').default
              }
            />
            <Stack.Screen
              name="WebviewScreen"
              getComponent={() =>
                require('@screens/WebviewScreen/WebviewScreen').default
              }
            />
          </Stack.Navigator>
        </UpdateContextProvider>
      </LibraryContextProvider>
    </NavigationContainer>
  );
};

export default MainNavigator;
