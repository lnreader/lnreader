import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Slider from '@react-native-community/slider';
import { getAvailableVoicesAsync, Voice } from 'expo-speech';
import {
  useTheme,
  useChapterGeneralSettings,
  useChapterReaderSettings,
} from '@hooks/persisted';
import { getString } from '@strings/translations';
import { List, Button } from '@components/index';
import SettingSwitch from '../../components/SettingSwitch';
import Switch from '@components/Switch/Switch';
import { useBoolean } from '@hooks';
import { Portal } from 'react-native-paper';
import VoicePickerModal from '../Modals/VoicePickerModal';

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
