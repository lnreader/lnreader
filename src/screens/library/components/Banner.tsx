import React from 'react';
import { Row } from '@expo/ui/jetpack-compose';
import {
  background,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';

import { AppIcon, AppText, type IconSource } from '@components';
import { ThemeColors } from '@theme/types';

interface Props {
  label: string;
  icon?: IconSource;
  backgroundColor?: string;
  textColor?: string;
  theme: ThemeColors;
}

export const Banner: React.FC<Props> = ({
  label,
  icon,
  theme,
  backgroundColor = theme.primary,
  textColor = theme.onPrimary,
}) => (
  <Row
    verticalAlignment="center"
    horizontalArrangement="center"
    modifiers={[
      fillMaxWidth(),
      background(backgroundColor),
      padding(0, 4, 0, 4),
    ]}
  >
    {icon ? <AppIcon source={icon} size={18} tint={textColor} /> : null}
    <AppText
      variant="labelMedium"
      weight="500"
      color={textColor}
      modifiers={[padding(icon ? 8 : 0, 0, 0, 0)]}
    >
      {label}
    </AppText>
  </Row>
);
