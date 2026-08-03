import React from 'react';
import { AssistChip } from '@expo/ui/jetpack-compose';

import { ExpoHost, getAssistChipColors } from '@components/ExpoUI';
import { ThemeColors } from '../../theme/types';

interface ChipProps {
  label: string;
  theme: ThemeColors;
}

const Chip: React.FC<ChipProps> = ({ label, theme }) => (
  <ExpoHost theme={theme} matchContents>
    <AssistChip colors={getAssistChipColors(theme)}>
      <AssistChip.Label>{label}</AssistChip.Label>
    </AssistChip>
  </ExpoHost>
);

export default Chip;
