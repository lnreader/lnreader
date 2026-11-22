import { useEffect } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import {
  setNavigationBarTransparent,
  setStatusBarColor,
} from '@theme/utils/setBarColor';
import { useAppSettings, usePluginActions, useTheme } from '@hooks/persisted';
import { AppUpdateChecker } from '@components';

import BottomNavigator from './BottomNavigator';
import { RootStackParamList } from './types';
import { useMMKVBoolean } from 'react-native-mmkv';
import OnboardingScreen from '@screens/onboarding/OnboardingScreen';
import { backgroundTasks } from '@services/backgroundTasks';
import ShareIntentHandler, {
  flushPendingShare,
  navigationRef,
} from './ShareIntentHandler';
import WidgetIntentHandler, {
  flushPendingWidgetLink,
  isWidgetUrl,
} from './WidgetIntentHandler';
import { LibraryContextProvider } from '@components/Context/LibraryContext';
import { UpdateContextProvider } from '@components/Context/UpdateContext';
import { useReactNavigationDevTools } from '@rozenite/react-navigation-plugin';
const Stack = createNativeStackNavigator<RootStackParamList>();

// Every screen above the bottom tabs is required on first navigation, so its
// module graph (reader, browse, settings...) is not evaluated at launch.
const getReaderStack = () => require('./ReaderStack').default;
const getMoreStack = () => require('./MoreStack').default;
const getSourceScreen = () =>
  require('@screens/BrowseSourceScreen/BrowseSourceScreen').default;
const getMalTopNovels = () =>
  require('@screens/browse/discover/MalTopNovels').default;
const getAniListTopNovels = () =>
  require('@screens/browse/discover/AniListTopNovels').default;
const getBrowseSettings = () =>
  require('@screens/browse/settings/BrowseSettings').default;
const getPluginDetails = () =>
  require('@screens/browse/PluginDetailsScreen').default;
const getGlobalSearch = () =>
  require('@screens/GlobalSearchScreen/GlobalSearchScreen').default;
const getMigration = () =>
  require('@screens/browse/migration/Migration').default;
const getSourceNovels = () => require('@screens/browse/SourceNovels').default;
const getMigrateNovel = () =>
  require('@screens/browse/migration/MigrationNovels').default;
const getWebviewScreen = () =>
  require('@screens/WebviewScreen/WebviewScreen').default;

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
    return <OnboardingScreen />;
  }
  return (
    <NavigationContainer<RootStackParamList>
      ref={navigationRef}
      onReady={() => {
        flushPendingShare();
        flushPendingWidgetLink();
      }}
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
        // Widget taps are routed by WidgetIntentHandler.
        filter: url => !isWidgetUrl(url),
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
      <WidgetIntentHandler />
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
            <Stack.Screen name="ReaderStack" getComponent={getReaderStack} />
            <Stack.Screen name="MoreStack" getComponent={getMoreStack} />
            <Stack.Screen name="SourceScreen" getComponent={getSourceScreen} />
            <Stack.Screen name="BrowseMal" getComponent={getMalTopNovels} />
            <Stack.Screen name="BrowseAL" getComponent={getAniListTopNovels} />
            <Stack.Screen
              name="BrowseSettings"
              getComponent={getBrowseSettings}
            />
            <Stack.Screen
              name="PluginDetails"
              getComponent={getPluginDetails}
            />
            <Stack.Screen
              name="GlobalSearchScreen"
              getComponent={getGlobalSearch}
            />
            <Stack.Screen name="Migration" getComponent={getMigration} />
            <Stack.Screen name="SourceNovels" getComponent={getSourceNovels} />
            <Stack.Screen name="MigrateNovel" getComponent={getMigrateNovel} />
            <Stack.Screen
              name="WebviewScreen"
              getComponent={getWebviewScreen}
            />
          </Stack.Navigator>
        </UpdateContextProvider>
      </LibraryContextProvider>
    </NavigationContainer>
  );
};

export default MainNavigator;
