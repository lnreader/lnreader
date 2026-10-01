import { StyleSheet, View } from 'react-native';
import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Spacer } from '@expo/ui/jetpack-compose';
import { height } from '@expo/ui/jetpack-compose/modifiers';

import {
  Appbar,
  BottomSheet,
  Fab,
  Screen,
  TopTabBar,
  useScreenInsets,
  type IconSource,
} from '@components/index';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import AutoStoriesIcon from '@expo/material-symbols/auto_stories.xml';
import FormatSizeIcon from '@expo/material-symbols/format_size.xml';
import PaletteIcon from '@expo/material-symbols/palette.xml';
import RecordVoiceOverIcon from '@expo/material-symbols/record_voice_over.xml';
import SettingsIcon from '@expo/material-symbols/settings.xml';
import SwipeIcon from '@expo/material-symbols/swipe.xml';

import SettingsReaderWebView from './components/SettingsReaderWebView';
import { useIsSettingsPane } from '../components/SettingsPage';
import DisplayTab from './tabs/DisplayTab';
import ThemeTab from './tabs/ThemeTab';
import NavigationTab from './tabs/NavigationTab';
import PaginationTab from './tabs/PaginationTab';
import AccessibilityTab from './tabs/AccessibilityTab';

type ReaderSettingsRoute = {
  key: 'display' | 'theme' | 'navigation' | 'pagination' | 'accessibility';
  title: string;
  icon: IconSource;
};

const routes: ReaderSettingsRoute[] = [
  { key: 'display', title: 'Display', icon: FormatSizeIcon },
  { key: 'theme', title: 'Theme', icon: PaletteIcon },
  { key: 'navigation', title: 'Navigation', icon: SwipeIcon },
  { key: 'pagination', title: 'Pagination', icon: AutoStoriesIcon },
  { key: 'accessibility', title: 'Accessibility', icon: RecordVoiceOverIcon },
];

export type TextAlignments =
  | 'left'
  | 'center'
  | 'auto'
  | 'right'
  | 'justify'
  | undefined;

const SettingsReaderScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [tabIndex, setTabIndex] = useState(0);
  const inSettingsPane = useIsSettingsPane();
  const { top } = useScreenInsets();
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);

  const readerSettings = useChapterReaderSettings();
  const readerBackgroundColor = readerSettings.theme;

  const renderTabContent = useCallback(
    ({ route }: { route: ReaderSettingsRoute }) => {
      switch (route.key) {
        case 'display':
          return <DisplayTab />;
        case 'theme':
          return <ThemeTab />;
        case 'navigation':
          return <NavigationTab />;
        case 'pagination':
          return <PaginationTab />;
        case 'accessibility':
          return <AccessibilityTab />;
        default:
          return <DisplayTab />;
      }
    },
    [],
  );

  const tabs = (
    <>
      <TopTabBar
        tabs={routes.map((route, i) => ({ key: i, label: route.title }))}
        selectedKey={tabIndex}
        onSelect={setTabIndex}
      />
      {renderTabContent({ route: routes[tabIndex] })}
    </>
  );

  return (
    <Screen
      topBar={
        // Beside the tablet settings list, pages go without a title bar.
        inSettingsPane ? (
          <Spacer modifiers={[height(top + 8)]} />
        ) : (
          <Appbar
            title={getString('readerSettings.title')}
            handleGoBack={navigation.goBack}
            theme={theme}
          />
        )
      }
      list={
        <View
          style={[styles.container, { backgroundColor: readerBackgroundColor }]}
        >
          <View style={styles.previewContainer}>
            <SettingsReaderWebView />
          </View>
        </View>
      }
      floatingAction={
        <Fab
          icon={SettingsIcon}
          label={getString('readerSettings.title')}
          onPress={() => setBottomSheetVisible(true)}
        />
      }
      overlays={
        <BottomSheet
          visible={bottomSheetVisible}
          onDismiss={() => setBottomSheetVisible(false)}
        >
          {tabs}
        </BottomSheet>
      }
    />
  );
};

export default SettingsReaderScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  previewContainer: {
    flex: 1,
  },
});
