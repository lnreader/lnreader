import React from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import { fillMaxSize, padding } from '@expo/ui/jetpack-compose/modifiers';

import { ThemeColors } from '../../theme/types';
import { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';
import Button from '../Button/Button';

interface EmptyViewProps {
  icon?: string;
  description: string;
  theme: ThemeColors;
  actions?: {
    iconName: IconSource;
    title: string;
    onPress: () => void;
  }[];
}

const EmptyView: React.FC<EmptyViewProps> = ({
  icon,
  description,
  theme,
  actions,
}) => (
  <Box
    contentAlignment="center"
    modifiers={[fillMaxSize(), padding(16, 16, 16, 16)]}
  >
    <Column horizontalAlignment="center">
      {icon ? (
        <AppText
          variant="displaySmall"
          weight="700"
          color={theme.outline}
          align="center"
        >
          {icon}
        </AppText>
      ) : null}
      <AppText
        color={theme.outline}
        align="center"
        modifiers={[padding(0, 16, 0, 0)]}
      >
        {description}
      </AppText>
      {actions?.length ? (
        <Row
          horizontalArrangement={{ spacedBy: 8 }}
          modifiers={[padding(0, 20, 0, 0)]}
        >
          {actions.map(action => (
            <Button
              key={action.title}
              onPress={action.onPress}
              icon={action.iconName}
              textColor={theme.outline}
              mode="outlined"
              title={action.title}
            />
          ))}
        </Row>
      ) : null}
    </Column>
  </Box>
);

export default EmptyView;
