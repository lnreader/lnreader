import React from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { AppText, SegmentedControl } from '@components';
import { getString } from '@i18n/translations';
import FormatAlignCenterIcon from '@expo/material-symbols/format_align_center.xml';
import FormatAlignJustifyIcon from '@expo/material-symbols/format_align_justify.xml';
import FormatAlignLeftIcon from '@expo/material-symbols/format_align_left.xml';
import FormatAlignRightIcon from '@expo/material-symbols/format_align_right.xml';

const ReaderTextAlignSelector: React.FC = () => {
  const theme = useTheme();
  const { textAlign, setChapterReaderSettings } = useChapterReaderSettings();
  const options = [
    {
      icon: FormatAlignLeftIcon,
      label: getString('readerScreen.bottomSheet.alignLeft'),
      value: 'left',
    },
    {
      icon: FormatAlignCenterIcon,
      label: getString('readerScreen.bottomSheet.alignCenter'),
      value: 'center',
    },
    {
      icon: FormatAlignJustifyIcon,
      label: getString('readerScreen.bottomSheet.alignJustify'),
      value: 'justify',
    },
    {
      icon: FormatAlignRightIcon,
      label: getString('readerScreen.bottomSheet.alignRight'),
      value: 'right',
    },
  ];

  return (
    <Column
      verticalArrangement={{ spacedBy: 8 }}
      modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
    >
      <AppText variant="bodyMedium" color={theme.onSurfaceVariant}>
        {getString('readerScreen.bottomSheet.textAlign')}
      </AppText>
      <SegmentedControl
        options={options}
        value={textAlign}
        onChange={value => setChapterReaderSettings({ textAlign: value })}
        theme={theme}
        iconOnly
      />
    </Column>
  );
};

export default ReaderTextAlignSelector;
