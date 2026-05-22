import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { List } from '@components/index';
import SettingSwitch from '../../components/SettingSwitch';

const AccessibilityTab: React.FC = () => {
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
    <BottomSheetScrollView
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
          value={fullScreenMode}
          onPress={() =>
            setChapterGeneralSettings({ fullScreenMode: !fullScreenMode })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.showProgressPercentage')}
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
          value={bionicReading}
          onPress={() =>
            setChapterGeneralSettings({ bionicReading: !bionicReading })
          }
          theme={theme}
        />
      </View>

      <View style={styles.bottomSpacing} />
    </BottomSheetScrollView>
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
