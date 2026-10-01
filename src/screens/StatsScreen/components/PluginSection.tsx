import { type ReactNode, useState } from 'react';
import { AnimatedVisibility, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import KeyboardArrowDownIcon from '@expo/material-symbols/keyboard_arrow_down.xml';
import KeyboardArrowUpIcon from '@expo/material-symbols/keyboard_arrow_up.xml';
import { AppIcon, AppText } from '@components';

const PluginSection = ({
  title,
  subtitle,
  count,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  children: ReactNode;
}) => {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  return (
    <Column modifiers={[fillMaxWidth()]}>
      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[
          fillMaxWidth(),
          clickable(() => setExpanded(current => !current)),
          padding(16, 12, 12, 12),
        ]}
      >
        <Column modifiers={[weight(1)]}>
          <AppText variant="titleSmall" maxLines={2}>
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="bodySmall" color={theme.onSurfaceVariant}>
              {subtitle}
            </AppText>
          ) : null}
        </Column>
        {count !== undefined ? (
          <AppText variant="labelLarge" color={theme.onSurfaceVariant}>
            {count.toLocaleString()}
          </AppText>
        ) : null}
        <AppIcon
          source={expanded ? KeyboardArrowUpIcon : KeyboardArrowDownIcon}
          tint={theme.onSurfaceVariant}
        />
      </Row>
      <AnimatedVisibility visible={expanded} modifiers={[fillMaxWidth()]}>
        <Column modifiers={[fillMaxWidth(), padding(0, 0, 0, 12)]}>
          {expanded ? children : null}
        </Column>
      </AnimatedVisibility>
    </Column>
  );
};

export default PluginSection;
