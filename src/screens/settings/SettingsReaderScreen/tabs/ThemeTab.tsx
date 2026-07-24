import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme, useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { List, ColorPreferenceItem, Button } from '@components/index';
import { useBoolean } from '@hooks';
import { Portal } from 'react-native-paper';
import ColorPickerModal from '@components/ColorPickerModal/ColorPickerModal';
import ReaderThemeSelector from '@screens/reader/components/ReaderBottomSheet/ReaderThemeSelector';
import { presetReaderThemes } from '@utils/constants/readerConstants';

const ThemeTab: React.FC = () => {
  const theme = useTheme();
  const readerSettings = useChapterReaderSettings();
  const readerBackgroundModal = useBoolean();
  const readerTextColorModal = useBoolean();

  const labelStyle = [styles.label, { color: theme.onSurface }];

  const isCurrentThemeCustom = readerSettings.customThemes.some(
    item =>
      item.backgroundColor === readerSettings.theme &&
      item.textColor === readerSettings.textColor,
  );

  const isCurrentThemePreset = presetReaderThemes.some(
    item =>
      item.backgroundColor === readerSettings.theme &&
      item.textColor === readerSettings.textColor,
  );

  return (
    <>
      <BottomSheetScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.section}>
          <List.SubHeader theme={theme}>
            {getString('readerSettings.preset')}
          </List.SubHeader>
          <ReaderThemeSelector
            label={getString('readerSettings.preset')}
            labelStyle={labelStyle}
          />
        </View>

        <View style={styles.section}>
          <List.SubHeader theme={theme}>Custom Colors</List.SubHeader>
          <ColorPreferenceItem
            label={getString('readerSettings.backgroundColor')}
            description={readerSettings.theme}
            onPress={readerBackgroundModal.setTrue}
            theme={theme}
          />
          <ColorPreferenceItem
            label={getString('readerSettings.textColor')}
            description={readerSettings.textColor}
            onPress={readerTextColorModal.setTrue}
            theme={theme}
          />
        </View>

        {isCurrentThemeCustom ? (
          <View style={styles.buttonContainer}>
            <Button
              style={styles.button}
              title={getString('readerSettings.deleteCustomTheme')}
              onPress={() =>
                readerSettings.deleteCustomReaderTheme({
                  backgroundColor: readerSettings.theme,
                  textColor: readerSettings.textColor,
                })
              }
            />
          </View>
        ) : !isCurrentThemePreset ? (
          <View style={styles.buttonContainer}>
            <Button
              style={styles.button}
              title={getString('readerSettings.saveCustomTheme')}
              onPress={() =>
                readerSettings.saveCustomReaderTheme({
                  backgroundColor: readerSettings.theme,
                  textColor: readerSettings.textColor,
                })
              }
            />
          </View>
        ) : null}

        <View style={styles.bottomSpacing} />
      </BottomSheetScrollView>

      <Portal>
        <ColorPickerModal
          title={getString('readerSettings.backgroundColor')}
          visible={readerBackgroundModal.value}
          color={readerSettings.theme}
          closeModal={readerBackgroundModal.setFalse}
          theme={theme}
          onSubmit={color =>
            readerSettings.setChapterReaderSettings({ theme: color })
          }
        />
        <ColorPickerModal
          title={getString('readerSettings.textColor')}
          visible={readerTextColorModal.value}
          color={readerSettings.textColor}
          closeModal={readerTextColorModal.setFalse}
          theme={theme}
          onSubmit={color =>
            readerSettings.setChapterReaderSettings({ textColor: color })
          }
        />
      </Portal>
    </>
  );
};

export default ThemeTab;

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
  label: {
    fontSize: 16,
  },
  buttonContainer: {
    marginVertical: 8,
    marginHorizontal: 16,
  },
  button: {
    marginVertical: 8,
  },
  bottomSpacing: {
    height: 24,
  },
});
