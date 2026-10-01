import { getString } from '@i18n/translations';
import React, { useState } from 'react';
import { Box, Column } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  height,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';

import { ThemeColors } from '@theme/types';
import { AppIcon, AppText } from '@components';
import KeyboardArrowDownIcon from '@expo/material-symbols/keyboard_arrow_down.xml';
import KeyboardArrowUpIcon from '@expo/material-symbols/keyboard_arrow_up.xml';

interface NovelSummaryProps {
  summary: string;
  isExpanded: boolean;
  theme: ThemeColors;
}

const NovelSummary: React.FC<NovelSummaryProps> = ({
  summary,
  isExpanded,
  theme,
}) => {
  const textColor = theme.onSurfaceVariant;

  const [expanded, setExpanded] = useState(isExpanded);
  const toggleExpanded = () => {
    if (summary) {
      setExpanded(!expanded);
    }
  };

  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        clickable(toggleExpanded),
        padding(16, 8, 16, expanded ? 16 : 0),
      ]}
    >
      <AppText
        variant="bodyMedium"
        color={textColor}
        maxLines={expanded ? undefined : 3}
      >
        {summary || getString('novelScreen.noSummary')}
      </AppText>
      {summary ? (
        <Box modifiers={[fillMaxWidth(), height(24)]} contentAlignment="center">
          <AppIcon
            source={expanded ? KeyboardArrowUpIcon : KeyboardArrowDownIcon}
            tint={theme.onBackground}
          />
        </Box>
      ) : null}
    </Column>
  );
};

export default NovelSummary;
