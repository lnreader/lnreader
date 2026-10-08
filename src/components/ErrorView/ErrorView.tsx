import { ThemeColors } from '@theme/types';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  clip,
  defaultMinSize,
  fillMaxSize,
  padding,
  Shapes,
} from '@expo/ui/jetpack-compose/modifiers';
import AppIcon, { type IconSource } from '../AppIcon/AppIcon';
import AppText from '../AppText/AppText';

interface ErrorAction {
  name: string;
  icon: IconSource;
  onPress: () => void;
}

interface ErrorViewProps {
  errorName: string;
  actions: ErrorAction[];
  theme: ThemeColors;
}

export const ErrorView = ({ errorName, actions, theme }: ErrorViewProps) => (
  <Box contentAlignment="center" modifiers={[fillMaxSize()]}>
    <Column horizontalAlignment="center">
      <AppText variant="displaySmall" color={theme.outline} align="center">
        ಥ_ಥ
      </AppText>
      <AppText
        weight="700"
        color={theme.outline}
        align="center"
        modifiers={[padding(30, 10, 30, 0)]}
      >
        {errorName}
      </AppText>
      <Row>
        {actions.map(action => (
          <Column
            key={action.name}
            horizontalAlignment="center"
            modifiers={[
              padding(16, 16, 16, 16),
              clip(Shapes.RoundedCorner(4)),
              clickable(action.onPress),
              defaultMinSize({ minWidth: 100 }),
              padding(20, 8, 20, 8),
            ]}
          >
            <AppIcon source={action.icon} tint={theme.outline} />
            <AppText color={theme.outline}>{action.name}</AppText>
          </Column>
        ))}
      </Row>
    </Column>
  </Box>
);
