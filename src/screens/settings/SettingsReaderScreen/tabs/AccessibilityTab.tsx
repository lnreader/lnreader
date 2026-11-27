import { Ref } from 'react';
import {
  ScrollView,
  View,
  StyleSheet,
  type ScrollViewInstance,
} from 'react-native';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { List } from '@components/index';
import SettingSwitch from '../../components/SettingSwitch';

interface AccessibilityTabProps {
  scrollRef?: Ref<ScrollViewInstance>;
}

const AccessibilityTab = ({ scrollRef }: AccessibilityTabProps) => {
  const theme = useTheme();
  const {
    fullScreenMode = true,
    showScrollPercentage = true,
    showBatteryAndTime = false,
    keepScreenOn = true,
    bionicReading = false,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.section}>
        <List.SubHeader theme={theme}>
          {getString('common.display')}
        </List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.fullscreen')}
          description={getString(
            'readerScreen.bottomSheet.fullscreenDescription',
          )}
          value={fullScreenMode}
          onPress={() =>
            setChapterGeneralSettings({ fullScreenMode: !fullScreenMode })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.showProgressPercentage')}
          description={getString(
            'readerScreen.bottomSheet.showProgressPercentageDescription',
          )}
          value={showScrollPercentage}
          onPress={() =>
            setChapterGeneralSettings({
              showScrollPercentage: !showScrollPercentage,
            })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.showBatteryAndTime')}
          description={getString(
            'readerScreen.bottomSheet.showBatteryAndTimeDescription',
          )}
          value={showBatteryAndTime}
          onPress={() =>
            setChapterGeneralSettings({
              showBatteryAndTime: !showBatteryAndTime,
            })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.keepScreenOn')}
          value={keepScreenOn}
          onPress={() =>
            setChapterGeneralSettings({ keepScreenOn: !keepScreenOn })
          }
          theme={theme}
        />
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>Reading Enhancements</List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.bionicReading')}
          description={getString(
            'readerScreen.bottomSheet.bionicReadingDescription',
          )}
          value={bionicReading}
          onPress={() =>
            setChapterGeneralSettings({ bionicReading: !bionicReading })
          }
          theme={theme}
        />
      </View>

      <View style={styles.bottomSpacing} />
    </ScrollView>
  );
};

export default AccessibilityTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  section: {
    marginVertical: 8,
  },
  bottomSpacing: {
    height: 24,
  },
});
