import React, { useEffect } from 'react';

import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { setStatusBarColor } from '@theme/utils/setBarColor';
import { useAppSettings, usePlugins, useTheme } from '@hooks/persisted';
import { useGithubUpdateChecker } from '@hooks/common/useGithubUpdateChecker';

/**
 * Navigators
 */
import BottomNavigator from './BottomNavigator';
import MoreStack from './MoreStack';

/**
 * Screens
 */

import BrowseSourceScreen from '../screens/BrowseSourceScreen/BrowseSourceScreen';
import GlobalSearchScreen from '../screens/GlobalSearchScreen/GlobalSearchScreen';
import Migration from '../screens/browse/migration/Migration';
import SourceNovels from '../screens/browse/SourceNovels';
import MigrateNovel from '../screens/browse/migration/MigrationNovels';

import MalTopNovels from '../screens/browse/discover/MalTopNovels';
import AniListTopNovels from '../screens/browse/discover/AniListTopNovels';
import NewUpdateDialog from '../components/NewUpdateDialog';
import BrowseSettings from '../screens/browse/settings/BrowseSettings';
import WebviewScreen from '@screens/WebviewScreen/WebviewScreen';
import { RootStackParamList } from './types';
import { useMMKVBoolean } from 'react-native-mmkv';
import OnboardingScreen from '@screens/onboarding/OnboardingScreen';
import ServiceManager from '@services/ServiceManager';
import ReaderStack from './ReaderStack';
import { LibraryContextProvider } from '@components/Context/LibraryContext';
import { UpdateContextProvider } from '@components/Context/UpdateContext';
const Stack = createNativeStackNavigator<RootStackParamList>();

const MainNavigator = () => {
  const theme = useTheme();
  const { updateLibraryOnLaunch } = useAppSettings();
  const { refreshPlugins } = usePlugins();
  const [isOnboarded] = useMMKVBoolean('IS_ONBOARDED');

  useEffect(() => {
    const timer = setTimeout(async () => {
      setStatusBarColor(theme);
    }, 500);

    return () => {
      clearTimeout(timer);
    };
  }, [theme]);

  useEffect(() => {
    if (updateLibraryOnLaunch) {
      ServiceManager.manager.addTask({ name: 'UPDATE_LIBRARY' });
    }
    if (isOnboarded) {
      // hack this helps app has enough time to initialize database;
      refreshPlugins();
    }
  }, [isOnboarded, refreshPlugins, updateLibraryOnLaunch]);

  const { isNewVersion, latestRelease } = useGithubUpdateChecker();

  if (!isOnboarded) {
    return <OnboardingScreen />;
  }

  return (
    <NavigationContainer<RootStackParamList>
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
      <LibraryContextProvider>
        <UpdateContextProvider>
          {isNewVersion && <NewUpdateDialog newVersion={latestRelease} />}
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="BottomNavigator" component={BottomNavigator} />
            <Stack.Screen name="ReaderStack" component={ReaderStack} />
            <Stack.Screen name="MoreStack" component={MoreStack} />
            <Stack.Screen name="SourceScreen" component={BrowseSourceScreen} />
            <Stack.Screen name="BrowseMal" component={MalTopNovels} />
            <Stack.Screen name="BrowseAL" component={AniListTopNovels} />
            <Stack.Screen name="BrowseSettings" component={BrowseSettings} />
            <Stack.Screen
              name="GlobalSearchScreen"
              component={GlobalSearchScreen}
            />
            <Stack.Screen name="Migration" component={Migration} />
            <Stack.Screen name="SourceNovels" component={SourceNovels} />
            <Stack.Screen name="MigrateNovel" component={MigrateNovel} />
            <Stack.Screen name="WebviewScreen" component={WebviewScreen} />
          </Stack.Navigator>
        </UpdateContextProvider>
      </LibraryContextProvider>
    </NavigationContainer>
  );
};

export default MainNavigator;
