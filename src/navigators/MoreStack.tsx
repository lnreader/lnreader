import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MoreStackParamList, SettingsStackParamList } from './types';
import { useTheme } from '@hooks/persisted';

/**
 * The settings tree pulls in charts, the code editor and the backup providers.
 * `getComponent` defers each screen's module to the navigation that opens it,
 * so entering "More" no longer evaluates the whole tree at once — and nothing
 * here is evaluated at all until the stack itself is opened.
 */
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
      <Stack.Screen
        name="Settings"
        getComponent={() =>
          require('../screens/settings/SettingsScreen').default
        }
      />
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
