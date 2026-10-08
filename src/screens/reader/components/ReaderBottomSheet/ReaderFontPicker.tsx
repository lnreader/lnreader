import React from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  horizontalScroll,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';

import { AppText, SelectableChip } from '@components/index';
import { getString } from '@i18n/translations';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { readerFonts } from '@utils/constants/readerConstants';

const ReaderFontPicker = () => {
  const theme = useTheme();
  const { fontFamily, setChapterReaderSettings } = useChapterReaderSettings();

  return (
    <Column modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}>
      <AppText
        variant="bodyMedium"
        color={theme.onSurfaceVariant}
        modifiers={[padding(16, 0, 16, 8)]}
      >
        {getString('readerScreen.bottomSheet.fontStyle')}
      </AppText>
      <Row
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[fillMaxWidth(), horizontalScroll(), padding(16, 0, 16, 0)]}
      >
        {readerFonts.map(item => (
          <SelectableChip
            key={item.fontFamily || 'original'}
            label={item.name}
            selected={item.fontFamily === fontFamily}
            theme={theme}
            onPress={() =>
              setChapterReaderSettings({ fontFamily: item.fontFamily })
            }
            customFontFamily={item.fontFamily || undefined}
          />
        ))}
      </Row>
    </Column>
  );
};

export default React.memo(ReaderFontPicker);
