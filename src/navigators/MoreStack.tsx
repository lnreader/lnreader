import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Only the first screen of each stack is linked statically. The rest are
// required on first navigation so that opening settings does not evaluate the
// syntax highlighter, the chart renderer and the backup providers as well.
import Settings from '../screens/settings/SettingsScreen';

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
      <Stack.Screen
        name="GeneralSettings"
        getComponent={() =>
          require('../screens/settings/SettingsGeneralScreen/SettingsGeneralScreen')
            .default
        }
      />
      <Stack.Screen
        name="ReaderSettings"
        getComponent={() =>
          require('../screens/settings/SettingsReaderScreen/SettingsReaderScreen')
            .default
        }
      />
      <Stack.Screen
        name="TrackerSettings"
        getComponent={() =>
          require('../screens/settings/SettingsTrackerScreen').default
        }
      />
      <Stack.Screen
        name="BackupSettings"
        getComponent={() =>
          require('../screens/settings/SettingsBackupScreen').default
        }
      />
      <Stack.Screen
        name="AppearanceSettings"
        getComponent={() =>
          require('../screens/settings/SettingsAppearanceScreen/SettingsAppearanceScreen')
            .default
        }
      />
      <Stack.Screen
        name="AdvancedSettings"
        getComponent={() =>
          require('../screens/settings/SettingsAdvancedScreen').default
        }
      />
      <Stack.Screen
        name="RespositorySettings"
        getComponent={() =>
          require('@screens/settings/SettingsRepositoryScreen/SettingsRepositoryScreen')
            .default
        }
      />
      <Stack.Screen
        name="LibrarySettings"
        getComponent={() =>
          require('@screens/settings/SettingsLibraryScreen/SettingsLibraryScreen')
            .default
        }
      />
      <Stack.Screen
        name="CustomCode"
        getComponent={() =>
          require('@screens/settings/SettingsCustomCodeScreen').default
        }
      />
      <Stack.Screen
        name="CodeSnippets"
        getComponent={() =>
          require('@screens/settings/SettingsCustomCodeScreen/CodeSnippetsScreen')
            .default
        }
      />
      <Stack.Screen
        name="GenreTaxonomy"
        getComponent={() =>
          require('@screens/settings/SettingsTaxonomyScreen/SettingsTaxonomyScreen')
            .default
        }
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
      <Stack.Screen
        name="About"
        getComponent={() => require('../screens/more/About').default}
      />
      <Stack.Screen
        name="TaskQueue"
        getComponent={() => require('../screens/more/TaskQueueScreen').default}
      />
      <Stack.Screen
        name="Downloads"
        getComponent={() => require('../screens/more/DownloadsScreen').default}
      />
      <Stack.Screen
        name="Categories"
        getComponent={() =>
          require('@screens/Categories/CategoriesScreen').default
        }
      />
      <Stack.Screen
        name="Statistics"
        getComponent={() => require('@screens/StatsScreen/StatsScreen').default}
      />
    </Stack.Navigator>
  );
};

export default MoreStack;
