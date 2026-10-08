import React from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  fillMaxSize,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import { getErrorMessage } from '@utils/error';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';

interface ErrorScreenProps {
  error: unknown;
  actions?: {
    iconName: IconSource;
    title: string;
    onPress: () => void;
  }[];
}

const ErrorScreen: React.FC<ErrorScreenProps> = ({ error, actions }) => {
  const theme = useTheme();

  return (
    <Box contentAlignment="center" modifiers={[fillMaxSize()]}>
      <Column horizontalAlignment="center">
        <AppText variant="displaySmall" color={theme.outline} align="center">
          ಥ_ಥ
        </AppText>
        <AppText
          color={theme.outline}
          align="center"
          modifiers={[padding(16, 16, 16, 0)]}
        >
          {getErrorMessage(error)}
        </AppText>
        {actions?.length ? (
          <Row modifiers={[padding(0, 20, 0, 0)]}>
            {actions.map(action => (
              <Column
                key={action.title}
                horizontalAlignment="center"
                modifiers={[
                  weight(1),
                  padding(4, 0, 4, 0),
                  clip(Shapes.RoundedCorner(50)),
                  clickable(action.onPress),
                  padding(0, 8, 0, 8),
                ]}
              >
                <AppIcon source={action.iconName} tint={theme.outline} />
                <AppText color={theme.outline}>{action.title}</AppText>
              </Column>
            ))}
          </Row>
        ) : null}
      </Column>
    </Box>
  );
};

export default ErrorScreen;
