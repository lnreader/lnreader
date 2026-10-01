import React from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  horizontalScroll,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { ToggleColorButton } from '@components/Common/ToggleButton';
import { AppText } from '@components';
import { getString } from '@i18n/translations';
import { presetReaderThemes } from '@utils/constants/readerConstants';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { ReaderTheme } from '@hooks/persisted/useSettings';

interface ReaderThemeSelectorProps {
  label?: string;
}

const ReaderThemeSelector: React.FC<ReaderThemeSelectorProps> = ({ label }) => {
  const theme = useTheme();

  const {
    theme: backgroundColor,
    textColor,
    customThemes,
    setChapterReaderSettings,
  } = useChapterReaderSettings();

  return (
    <Column modifiers={[fillMaxWidth(), padding(0, 8, 0, 8)]}>
      <AppText
        variant="bodyMedium"
        color={theme.onSurfaceVariant}
        modifiers={[padding(16, 0, 16, 8)]}
      >
        {label || getString('readerScreen.bottomSheet.color')}
      </AppText>
      <Row
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth(), horizontalScroll(), padding(16, 0, 16, 0)]}
      >
        {([...customThemes, ...presetReaderThemes] as ReaderTheme[]).map(
          (item, index) => (
            <ToggleColorButton
              key={item.textColor + '_' + index}
              selected={
                backgroundColor === item.backgroundColor &&
                textColor === item.textColor
              }
              backgroundColor={item.backgroundColor}
              textColor={item.textColor}
              theme={theme}
              onPress={() =>
                setChapterReaderSettings({
                  theme: item.backgroundColor,
                  textColor: item.textColor,
                })
              }
            />
          ),
        )}
      </Row>
    </Column>
  );
};

export default ReaderThemeSelector;
