import { StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Screens
import About from '../screens/more/About';
import Settings from '../screens/settings/SettingsScreen';
import TrackerSettings from '../screens/settings/SettingsTrackerScreen';
import ReaderSettings from '../screens/settings/SettingsReaderScreen/SettingsReaderScreen';
import BackupSettings from '../screens/settings/SettingsBackupScreen';
import AdvancedSettings from '../screens/settings/SettingsAdvancedScreen';
import GeneralSettings from '../screens/settings/SettingsGeneralScreen/SettingsGeneralScreen';
import TaskQueue from '../screens/more/TaskQueueScreen';
import Downloads from '../screens/more/DownloadsScreen';
import AppearanceSettings from '../screens/settings/SettingsAppearanceScreen/SettingsAppearanceScreen';
import CategoriesScreen from '@screens/Categories/CategoriesScreen';
import SettingsCustomCode from '@screens/settings/SettingsCustomCodeScreen';
import CodeSnippetsScreen from '@screens/settings/SettingsCustomCodeScreen/CodeSnippetsScreen';
import RespositorySettings from '@screens/settings/SettingsRepositoryScreen/SettingsRepositoryScreen';
import LibrarySettings from '@screens/settings/SettingsLibraryScreen/SettingsLibraryScreen';
import StatsScreen from '@screens/StatsScreen/StatsScreen';
import GenreTaxonomyScreen from '@screens/settings/SettingsTaxonomyScreen/SettingsTaxonomyScreen';
import { MoreStackParamList, SettingsStackParamList } from './types';
import { useTheme } from '@hooks/persisted/useTheme';
import { SettingsListDetailLayout } from '@screens/settings/SettingsCategories';
import { useRailLayout } from './destinations';
import { TopLevelScreenProvider, useIsTopLevelScreen } from '@components';

const Stack = createNativeStackNavigator<
  MoreStackParamList & SettingsStackParamList
>();

const SettingsStack = () => {
  const theme = useTheme();
  // The settings root is top-level when the settings are a rail destination.
  const topLevel = useIsTopLevelScreen();

  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'none',
        contentStyle: { backgroundColor: theme.background },
        headerShown: false,
      }}
      screenLayout={({ route, navigation, children }) => (
        <TopLevelScreenProvider
          value={topLevel && navigation.getState().routes[0]?.key === route.key}
        >
          {children}
        </TopLevelScreenProvider>
      )}
      layout={({ state, navigation, children }) => (
        <SettingsListDetailLayout
          state={state}
          // Picking a category swaps the detail page instead of stacking.
          onSelect={route => navigation.dispatch(StackActions.replace(route))}
          onBack={() => navigation.getParent()?.goBack()}
        >
          {children}
        </SettingsListDetailLayout>
      )}
    >
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen name="GeneralSettings" component={GeneralSettings} />
      <Stack.Screen name="ReaderSettings" component={ReaderSettings} />
      <Stack.Screen name="TrackerSettings" component={TrackerSettings} />
      <Stack.Screen name="BackupSettings" component={BackupSettings} />
      <Stack.Screen name="AppearanceSettings" component={AppearanceSettings} />
      <Stack.Screen name="AdvancedSettings" component={AdvancedSettings} />
      <Stack.Screen
        name="RespositorySettings"
        component={RespositorySettings}
      />
      <Stack.Screen name="LibrarySettings" component={LibrarySettings} />
      <Stack.Screen name="CustomCode" component={SettingsCustomCode} />
      <Stack.Screen name="CodeSnippets" component={CodeSnippetsScreen} />
      <Stack.Screen name="GenreTaxonomy" component={GenreTaxonomyScreen} />
      {/* Opened from the tablet category list, beside it like the other pages. */}
      <Stack.Screen name="About" component={About} />
    </Stack.Navigator>
  );
};

const MoreStack = () => {
  const theme = useTheme();
  const { extended } = useRailLayout();

  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'none',
        contentStyle: { backgroundColor: theme.background },
        headerShown: false,
      }}
      // On a tall rail these screens are destinations of their own: the one a
      // rail tap opens shows no back arrow.
      screenLayout={({ route, navigation, children }) => (
        <TopLevelScreenProvider
          value={extended && navigation.getState().routes[0]?.key === route.key}
        >
          {children}
        </TopLevelScreenProvider>
      )}
    >
      <Stack.Screen name="SettingsStack" component={SettingsStack} />
      <Stack.Screen name="About" component={About} />
      <Stack.Screen name="TaskQueue" component={TaskQueue} />
      <Stack.Screen name="Downloads" component={Downloads} />
      <Stack.Screen name="Categories" component={CategoriesScreen} />
      <Stack.Screen name="Statistics" component={StatsScreen} />
    </Stack.Navigator>
  );
};

export default MoreStack;
