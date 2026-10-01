import { useEffect } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';

import { List, Screen, SwitchItem } from '@components';

import { MoreHeader } from './components/MoreHeader';
import { useLibrarySettings, useTheme } from '@hooks/persisted';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import { MoreStackScreenProps } from '@navigators/types';
import { useMMKVObject } from 'react-native-mmkv';
import {
  BACKGROUND_TASKS_STORE_KEY,
  QueuedBackgroundTask,
} from '@services/backgroundTasks';
import BarChartIcon from '@expo/material-symbols/bar_chart.xml';
import CloudOffIcon from '@expo/material-symbols/cloud_off.xml';
import DownloadIcon from '@expo/material-symbols/download.xml';
import InfoIcon from '@expo/material-symbols/info.xml';
import LabelIcon from '@expo/material-symbols/label.xml';
import PendingActionsIcon from '@expo/material-symbols/pending_actions.xml';
import SettingsIcon from '@expo/material-symbols/settings.xml';
import VisibilityOffIcon from '@expo/material-symbols/visibility_off.xml';

const MoreScreen = ({ navigation }: MoreStackScreenProps) => {
  const theme = useTheme();
  const layout = useWindowLayout();
  const [taskQueue] = useMMKVObject<QueuedBackgroundTask[]>(
    BACKGROUND_TASKS_STORE_KEY,
  );
  const {
    incognitoMode = false,
    downloadedOnlyMode = false,
    setLibrarySettings,
  } = useLibrarySettings();

  const enableDownloadedOnlyMode = () =>
    setLibrarySettings({ downloadedOnlyMode: !downloadedOnlyMode });

  const enableIncognitoMode = () =>
    setLibrarySettings({ incognitoMode: !incognitoMode });

  // Wide windows show the settings categories beside a page, so open one.
  const settingsScreen = layout.isExpanded ? 'GeneralSettings' : 'Settings';

  useEffect(
    () =>
      navigation.addListener('tabPress', e => {
        if (navigation.isFocused()) {
          e.preventDefault();

          navigation.navigate('MoreStack', {
            screen: 'SettingsStack',
            params: {
              screen: settingsScreen,
            },
          });
        }
      }),
    [navigation, settingsScreen],
  );

  return (
    <Screen>
      <Column modifiers={[fillMaxSize(), verticalScroll()]}>
        <MoreHeader
          // status bar is translucent, text could be mess with it
          title={''}
          navigation={navigation}
          theme={theme}
        />
        <List.Section>
          <SwitchItem
            icon={CloudOffIcon}
            label={getString('moreScreen.downloadOnly')}
            description={getString('moreScreen.downloadOnlyDesc')}
            value={downloadedOnlyMode}
            onPress={enableDownloadedOnlyMode}
            theme={theme}
          />
          <SwitchItem
            icon={VisibilityOffIcon}
            label={getString('moreScreen.incognitoMode')}
            description={getString('moreScreen.incognitoModeDesc')}
            value={incognitoMode}
            onPress={enableIncognitoMode}
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.Item
            title={'Task Queue'}
            description={
              taskQueue && taskQueue.length > 0
                ? taskQueue.length + ' remaining'
                : ''
            }
            icon={PendingActionsIcon}
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'TaskQueue',
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('common.downloads')}
            icon={DownloadIcon}
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'Downloads',
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('common.categories')}
            icon={LabelIcon}
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'Categories',
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('statsScreen.title')}
            icon={BarChartIcon}
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'Statistics',
              })
            }
            theme={theme}
          />
          <List.Divider theme={theme} />
          <List.Item
            title={getString('common.settings')}
            icon={SettingsIcon}
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'SettingsStack',
                params: {
                  screen: settingsScreen,
                },
              })
            }
            theme={theme}
          />
          <List.Item
            title={getString('common.about')}
            icon={InfoIcon}
            onPress={() =>
              navigation.navigate('MoreStack', {
                screen: 'About',
              })
            }
            theme={theme}
          />
        </List.Section>
      </Column>
    </Screen>
  );
};

export default MoreScreen;
