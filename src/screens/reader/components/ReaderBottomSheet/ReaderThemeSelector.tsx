import { StyleSheet, Text, TextStyle, View } from 'react-native';
import React from 'react';
import { ToggleColorButton } from '@components/Common/ToggleButton';
import { getString } from '@i18n/translations';
import { presetReaderThemes } from '@utils/constants/readerConstants';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { FlatList } from 'react-native-gesture-handler';
import { ReaderTheme } from '@hooks/persisted/useSettings';

interface ReaderThemeSelectorProps {
  label?: string;
  labelStyle?: TextStyle | TextStyle[];
}

const ReaderThemeSelector: React.FC<ReaderThemeSelectorProps> = ({
  label,
  labelStyle,
}) => {
  const theme = useTheme();

  const {
    theme: backgroundColor,
    textColor,
    customThemes,
    setChapterReaderSettings,
  } = useChapterReaderSettings();

  return (
    <View style={styles.container}>
      <Text
        style={[{ color: theme.onSurfaceVariant }, styles.title, labelStyle]}
      >
        {label || getString('readerScreen.bottomSheet.color')}
      </Text>
      <FlatList
        data={[...customThemes, ...presetReaderThemes] as ReaderTheme[]}
        renderItem={({ item, index }) => (
          <ToggleColorButton
            key={index}
            selected={
              backgroundColor === item.backgroundColor &&
              textColor === item.textColor
            }
            backgroundColor={item.backgroundColor}
            textColor={item.textColor}
            onPress={() =>
              setChapterReaderSettings({
                theme: item.backgroundColor,
                textColor: item.textColor,
              })
            }
          />
        )}
        keyExtractor={(item, index) => item.textColor + '_' + index}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
};

export default ReaderThemeSelector;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 8,
    paddingHorizontal: 16,
  },
  scrollView: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  title: {
    marginRight: 16,
  },
});
