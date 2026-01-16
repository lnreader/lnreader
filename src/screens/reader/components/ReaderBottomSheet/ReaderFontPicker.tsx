import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SelectableChip } from '@components/index';
import { getString } from '@strings/translations';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';

import { Font, readerFonts } from '@utils/constants/readerConstants';
import { FlatList } from 'react-native-gesture-handler';

interface FontChipProps {
  item: Font;
}

const ReaderFontPicker = () => {
  const theme = useTheme();
  const { fontFamily, setChapterReaderSettings } = useChapterReaderSettings();

  const isSelected = useCallback(
    (item: Font) => item.fontFamily === fontFamily,
    [fontFamily],
  );

  const FontChipItem = useCallback(
    ({ item }: FontChipProps) => {
      return (
        <SelectableChip
          key={item.fontFamily}
          label={item.name}
          selected={isSelected(item)}
          theme={theme}
          onPress={() =>
            setChapterReaderSettings({ fontFamily: item.fontFamily })
          }
          customFontFamily={item.fontFamily}
        />
      );
    },
    [isSelected, setChapterReaderSettings, theme],
  );

  return (
    <View style={styles.row}>
      <Text style={[{ color: theme.onSurfaceVariant }, styles.title]}>
        {getString('readerScreen.bottomSheet.fontStyle')}
      </Text>
      <FlatList
        data={readerFonts}
        renderItem={FontChipItem}
        keyExtractor={(item, index) => 'font' + index}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

export default React.memo(ReaderFontPicker);
const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  title: {
    marginEnd: 16,
  },
});
