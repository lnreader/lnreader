import { useEffect } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';
import { StackActions } from '@react-navigation/native';

import { Appbar, List, Screen } from '@components';
import { useTheme } from '@hooks/persisted';

import { getString } from '@i18n/translations';
import { SettingsScreenProps } from '@navigators/types';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import TuneIcon from '@expo/material-symbols/tune.xml';
import PaletteIcon from '@expo/material-symbols/palette.xml';
import ShelvesIcon from '@expo/material-symbols/shelves.xml';
import ChromeReaderModeIcon from '@expo/material-symbols/chrome_reader_mode.xml';
import SourceEnvironmentIcon from '@expo/material-symbols/source_environment.xml';
import CodeIcon from '@expo/material-symbols/code.xml';
import SyncIcon from '@expo/material-symbols/sync.xml';
import BackupIcon from '@expo/material-symbols/backup.xml';
import BuildIcon from '@expo/material-symbols/build.xml';
import CategoryIcon from '@expo/material-symbols/category.xml';

const SettingsScreen = ({ navigation }: SettingsScreenProps) => {
  const theme = useTheme();
  const layout = useWindowLayout();

  // Wide windows list these categories in a pane beside the open page.
  useEffect(() => {
    if (layout.isExpanded) {
      navigation.dispatch(StackActions.replace('GeneralSettings'));
    }
  }, [layout.isExpanded, navigation]);

  return (
    <Screen
      topBar={
        <Appbar
          title={getString('common.settings')}
          handleGoBack={navigation.goBack}
          theme={theme}
        />
      }
    >
      <Column modifiers={[fillMaxSize(), verticalScroll()]}>
        <List.Item
          title={getString('generalSettings')}
          icon={TuneIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'GeneralSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('appearance')}
          icon={PaletteIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'AppearanceSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('library')}
          icon={ShelvesIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'LibrarySettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('readerSettings.title')}
          icon={ChromeReaderModeIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'ReaderSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title="Repositories"
          icon={SourceEnvironmentIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'RespositorySettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title="Custom Code"
          icon={CodeIcon}
          onPress={() => navigation.navigate('CustomCode')}
          theme={theme}
        />
        <List.Item
          title={getString('tracking')}
          icon={SyncIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'TrackerSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('common.backup')}
          icon={BackupIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'BackupSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('advancedSettings')}
          icon={BuildIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'AdvancedSettings',
            })
          }
          theme={theme}
        />
        <List.Item
          title={getString('genreStats.taxonomyTitle')}
          icon={CategoryIcon}
          onPress={() =>
            navigation.navigate('SettingsStack', {
              screen: 'GenreTaxonomy',
            })
          }
          theme={theme}
        />
      </Column>
    </Screen>
  );
};

export default SettingsScreen;
