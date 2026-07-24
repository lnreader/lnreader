import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useTheme, useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import ReaderTextSize from '../ReaderTextSize';
import ReaderValueChange from '@screens/reader/components/ReaderBottomSheet/ReaderValueChange';
import ReaderTextAlignSelector from '@screens/reader/components/ReaderBottomSheet/ReaderTextAlignSelector';
import { List } from '@components/index';
import { useBoolean } from '@hooks';
import { Portal } from 'react-native-paper';
import FontPickerModal from '../Modals/FontPickerModal';
import { readerFonts } from '@utils/constants/readerConstants';

const DisplayTab: React.FC = () => {
  const theme = useTheme();
  const readerSettings = useChapterReaderSettings();
  const readerFontPickerModal = useBoolean();

  const labelStyle = [styles.label, { color: theme.onSurface }];

  const currentFontName = readerFonts.find(
    item => item.fontFamily === readerSettings.fontFamily,
  )?.name;

  return (
    <>
      <BottomSheetScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        <View style={styles.content}>
          <ReaderTextSize labelStyle={labelStyle} />
          <ReaderValueChange
            labelStyle={labelStyle}
            label={getString('readerScreen.bottomSheet.lineHeight')}
            valueKey="lineHeight"
          />
          <ReaderValueChange
            labelStyle={labelStyle}
            label={getString('readerScreen.bottomSheet.padding')}
            valueKey="padding"
            valueChange={2}
            min={0}
            max={50}
            decimals={0}
            unit="px"
          />
          <ReaderTextAlignSelector labelStyle={labelStyle} />
          <List.Item
            title={getString('readerScreen.bottomSheet.fontStyle')}
            description={currentFontName}
            onPress={readerFontPickerModal.setTrue}
            theme={theme}
          />
        </View>

        <View style={styles.bottomSpacing} />
      </BottomSheetScrollView>

      <Portal>
        <FontPickerModal
          currentFont={readerSettings.fontFamily}
          visible={readerFontPickerModal.value}
          onDismiss={readerFontPickerModal.setFalse}
        />
      </Portal>
    </>
  );
};

export default DisplayTab;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  content: {
    paddingTop: 8,
  },
  label: {
    fontSize: 16,
  },
  bottomSpacing: {
    height: 24,
  },
});
