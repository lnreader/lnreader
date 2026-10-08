import React from 'react';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { AppText, Slider } from '@components';
import { getString } from '@i18n/translations';

const ReaderTextSize: React.FC = () => {
  const theme = useTheme();
  const { textSize, setChapterReaderSettings } = useChapterReaderSettings();
  const [dragValue, setDragValue] = React.useState<number>();

  return (
    <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <AppText
          variant="bodyMedium"
          color={theme.onSurfaceVariant}
          modifiers={[weight(1)]}
        >
          {getString('readerScreen.bottomSheet.textSize')}
        </AppText>
        <AppText variant="labelLarge">{`${dragValue ?? textSize}px`}</AppText>
      </Row>
      <Slider
        value={textSize}
        min={12}
        max={50}
        step={1}
        showStops
        onValueChange={setDragValue}
        onSlidingComplete={value => {
          setDragValue(undefined);
          setChapterReaderSettings({ textSize: value });
        }}
      />
    </Column>
  );
};

export default ReaderTextSize;
