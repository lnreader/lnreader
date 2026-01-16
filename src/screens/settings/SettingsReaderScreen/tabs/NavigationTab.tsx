import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { TextInput } from 'react-native-paper';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { defaultTo } from 'lodash-es';
import { useTheme, useChapterGeneralSettings } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { List, Button } from '@components/index';
import SettingSwitch from '../../components/SettingSwitch';

const NavigationTab: React.FC = () => {
  const theme = useTheme();
  const {
    useVolumeButtons = false,
    volumeButtonsOffset = null,
    verticalSeekbar = true,
    swipeGestures = false,
    pageReader = false,
    autoScroll = false,
    autoScrollInterval = 10,
    autoScrollOffset = null,
    tapToScroll = false,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const { height: screenHeight } = useWindowDimensions();

  const areAutoScrollSettingsDefault =
    autoScrollInterval === 10 && autoScrollOffset === null;

  return (
    <BottomSheetScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.contentContainer}
    >
      <View style={styles.section}>
        <List.SubHeader theme={theme}>Navigation Controls</List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.volumeButtonsScroll')}
          value={useVolumeButtons}
          onPress={() =>
            setChapterGeneralSettings({ useVolumeButtons: !useVolumeButtons })
          }
          theme={theme}
        />
        {useVolumeButtons && (
          <View style={styles.inputContainer}>
            <TextInput
              label={getString('readerSettings.volumeButtonsOffset')}
              mode="outlined"
              keyboardType="numeric"
              defaultValue={defaultTo(
                volumeButtonsOffset,
                Math.round(screenHeight * 0.75),
              ).toString()}
              onChangeText={text => {
                if (text) {
                  setChapterGeneralSettings({
                    volumeButtonsOffset: Number(text),
                  });
                }
              }}
              style={styles.textInput}
              theme={{ colors: { ...theme } }}
            />
          </View>
        )}
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.verticalSeekbar')}
          description={getString('readerSettings.verticalSeekbarDesc')}
          value={verticalSeekbar}
          onPress={() =>
            setChapterGeneralSettings({ verticalSeekbar: !verticalSeekbar })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.swipeGestures')}
          value={swipeGestures}
          onPress={() =>
            setChapterGeneralSettings({ swipeGestures: !swipeGestures })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.tapToScroll')}
          value={tapToScroll}
          onPress={() =>
            setChapterGeneralSettings({ tapToScroll: !tapToScroll })
          }
          theme={theme}
        />
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>Reading Mode</List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.pageReader')}
          value={pageReader}
          onPress={() => setChapterGeneralSettings({ pageReader: !pageReader })}
          theme={theme}
        />
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>
          {getString('readerScreen.bottomSheet.autoscroll')}
        </List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.autoscroll')}
          value={autoScroll}
          onPress={() => setChapterGeneralSettings({ autoScroll: !autoScroll })}
          theme={theme}
        />
        {autoScroll && (
          <>
            <View style={styles.inputContainer}>
              <TextInput
                label={getString('readerSettings.autoScrollInterval')}
                mode="outlined"
                keyboardType="numeric"
                defaultValue={defaultTo(autoScrollInterval, 10).toString()}
                onChangeText={text => {
                  if (text) {
                    setChapterGeneralSettings({
                      autoScrollInterval: Number(text),
                    });
                  }
                }}
                style={styles.textInput}
                theme={{ colors: { ...theme } }}
              />
            </View>
            <View style={styles.inputContainer}>
              <TextInput
                label={getString('readerSettings.autoScrollOffset')}
                mode="outlined"
                keyboardType="numeric"
                defaultValue={defaultTo(
                  autoScrollOffset,
                  Math.round(screenHeight),
                ).toString()}
                onChangeText={text => {
                  if (text) {
                    setChapterGeneralSettings({
                      autoScrollOffset: Number(text),
                    });
                  }
                }}
                style={styles.textInput}
                theme={{ colors: { ...theme } }}
              />
            </View>
            {!areAutoScrollSettingsDefault && (
              <View style={styles.buttonContainer}>
                <Button
                  style={styles.button}
                  title={getString('common.reset')}
                  onPress={() => {
                    setChapterGeneralSettings({ autoScrollInterval: 10 });
                    setChapterGeneralSettings({ autoScrollOffset: null });
                  }}
                />
              </View>
            )}
          </>
        )}
      </View>

      <View style={styles.bottomSpacing} />
    </BottomSheetScrollView>
  );
};

export default NavigationTab;

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
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  textInput: {
    fontSize: 14,
  },
  buttonContainer: {
    marginHorizontal: 16,
    marginVertical: 8,
  },
  button: {
    marginVertical: 8,
  },
  bottomSpacing: {
    height: 24,
  },
});
