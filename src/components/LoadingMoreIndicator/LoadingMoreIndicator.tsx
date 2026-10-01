import { Box, LoadingIndicator } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { ThemeColors } from '@theme/types';

interface Props {
  theme: ThemeColors;
}

const LoadingMoreIndicator: React.FC<Props> = ({ theme }) => {
  return (
    <Box
      contentAlignment="center"
      modifiers={[fillMaxWidth(), padding(0, 16, 0, 16)]}
    >
      <LoadingIndicator color={theme.primary} />
    </Box>
  );
};

export default LoadingMoreIndicator;
