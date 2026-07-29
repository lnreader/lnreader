import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { TextInput } from 'react-native-paper';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { defaultTo } from 'lodash-es';
import { useTheme, useChapterGeneralSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
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
    continuousReading = false,
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
          description={getString(
            'readerScreen.bottomSheet.volumeButtonsScrollDescription',
          )}
          value={useVolumeButtons}
          onPress={() =>
            setChapterGeneralSettings({ useVolumeButtons: !useVolumeButtons })
          }
          theme={theme}
        />
        {useVolumeButtons && (
          <View style={styles.inputContainer}>
            <TextInput
              label={getString('readerSettings.volumeButtonOffset')}
              mode="outlined"
              keyboardType="numeric"
              defaultValue={defaultTo(
                volumeButtonsOffset
                  ? Math.round(volumeButtonsOffset / screenHeight)
                  : null,
                0.75,
              ).toString()}
              onChangeText={text => {
                if (!isNaN(Number(text))) {
                  setChapterGeneralSettings({
                    volumeButtonsOffset: Math.round(
                      Number(text) * screenHeight,
                    ),
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
          description={getString(
            'readerScreen.bottomSheet.verticalSeekbarDescription',
          )}
          value={verticalSeekbar}
          onPress={() =>
            setChapterGeneralSettings({ verticalSeekbar: !verticalSeekbar })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.swipeGestures')}
          description={getString(
            'readerScreen.bottomSheet.swipeGesturesDescription',
          )}
          value={swipeGestures}
          onPress={() =>
            setChapterGeneralSettings({ swipeGestures: !swipeGestures })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.tapToScroll')}
          description={getString(
            'readerScreen.bottomSheet.tapToScrollDescription',
          )}
          value={tapToScroll}
          onPress={() =>
            setChapterGeneralSettings({ tapToScroll: !tapToScroll })
          }
          theme={theme}
        />
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>
          {getString('readerScreen.bottomSheet.readingMode')}
        </List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.pageReader')}
          description={getString(
            'readerScreen.bottomSheet.pageReaderDescription',
          )}
          value={pageReader}
          onPress={() =>
            // Paged and continuous reading are two answers to the same
            // question, so turning one on turns the other off.
            setChapterGeneralSettings({
              pageReader: !pageReader,
              continuousReading: pageReader ? continuousReading : false,
            })
          }
          theme={theme}
        />
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.continuousReading')}
          description={getString(
            'readerScreen.bottomSheet.continuousReadingDescription',
          )}
          value={continuousReading}
          onPress={() =>
            setChapterGeneralSettings({
              continuousReading: !continuousReading,
              pageReader: continuousReading ? pageReader : false,
            })
          }
          theme={theme}
        />
      </View>

      <View style={styles.section}>
        <List.SubHeader theme={theme}>
          {getString('readerScreen.bottomSheet.autoscroll')}
        </List.SubHeader>
        <SettingSwitch
          label={getString('readerScreen.bottomSheet.autoscroll')}
          description={getString(
            'readerScreen.bottomSheet.autoscrollDescription',
          )}
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
