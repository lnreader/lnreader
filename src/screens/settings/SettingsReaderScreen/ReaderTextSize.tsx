import { StyleSheet, Text, TextStyle, View } from 'react-native';
import React from 'react';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { IconButtonV2 } from '@components/index';
import { getString } from '@i18n/translations';

interface ReaderTextSizeProps {
  labelStyle?: TextStyle | TextStyle[];
}

const ReaderTextSize: React.FC<ReaderTextSizeProps> = ({ labelStyle }) => {
  const theme = useTheme();
  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();

  return (
    <View style={styles.container}>
      <Text style={[{ color: theme.onSurfaceVariant }, labelStyle]}>
        {getString('readerScreen.bottomSheet.textSize')}
      </Text>
      <View style={styles.buttonContainer}>
        <IconButtonV2
          name="minus"
          color={theme.primary}
          size={26}
          disabled={textSize <= 0}
          onPress={() => setChapterReaderSettings({ textSize: textSize - 1 })}
          theme={theme}
        />
        <Text style={[styles.value, { color: theme.onSurface }]}>
          {textSize}
        </Text>
        <IconButtonV2
          name="plus"
          color={theme.primary}
          size={26}
          onPress={() => setChapterReaderSettings({ textSize: textSize + 1 })}
          theme={theme}
        />
      </View>
    </View>
  );
};

export default ReaderTextSize;

const styles = StyleSheet.create({
  buttonContainer: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  container: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 6,
    paddingHorizontal: 16,
  },
  value: {
    paddingHorizontal: 24,
  },
});
