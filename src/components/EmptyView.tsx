import { useTheme } from '@hooks/persisted';
import React from 'react';
import { Box, Column } from '@expo/ui/jetpack-compose';
import { fillMaxSize, padding } from '@expo/ui/jetpack-compose/modifiers';
import AppText from './AppText/AppText';

interface EmptyViewProps {
  icon: string;
  description: string;
  children?: React.ReactNode;
}

const EmptyView = ({ icon, description, children }: EmptyViewProps) => {
  const theme = useTheme();

  return (
    <Box contentAlignment="center" modifiers={[fillMaxSize()]}>
      <Column horizontalAlignment="center">
        <AppText variant="displaySmall" color={theme.outline} align="center">
          {icon}
        </AppText>
        <AppText
          weight="700"
          color={theme.outline}
          align="center"
          modifiers={[padding(30, 10, 30, 0)]}
        >
          {description}
        </AppText>
        {children}
      </Column>
    </Box>
  );
};

export default EmptyView;
