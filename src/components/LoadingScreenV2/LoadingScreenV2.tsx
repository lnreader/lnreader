import React from 'react';
import { Box, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { fillMaxSize } from '@expo/ui/jetpack-compose/modifiers';

import { ThemeColors } from '../../theme/types';

const LoadingScreen: React.FC<{ theme: ThemeColors }> = ({ theme }) => (
  <Box contentAlignment="center" modifiers={[fillMaxSize()]}>
    <LoadingIndicator color={theme.primary} />
  </Box>
);

export default LoadingScreen;
