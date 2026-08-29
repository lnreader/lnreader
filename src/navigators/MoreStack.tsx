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
import TranslationSettingsScreen from '@screens/settings/TranslationSettingsScreen';
import { MoreStackParamList, SettingsStackParamList } from './types';
import { useTheme } from '@hooks/persisted';

const Stack = createNativeStackNavigator<
  MoreStackParamList & SettingsStackParamList
>();

const SettingsStack = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'none',
        contentStyle: { backgroundColor: theme.background },
        headerShown: false,
      }}
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
      <Stack.Screen
        name="TranslationSettings"
        component={TranslationSettingsScreen}
      />
    </Stack.Navigator>
  );
};

const MoreStack = () => {
  const theme = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        animation: 'none',
        contentStyle: { backgroundColor: theme.background },
        headerShown: false,
      }}
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
