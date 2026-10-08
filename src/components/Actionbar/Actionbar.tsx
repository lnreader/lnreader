import { Box, HorizontalFloatingToolbar } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import IconButtonV2 from '../IconButtonV2/IconButtonV2';
import { useScreenInsets } from '../Screen/insets';
import { type IconSource } from '../AppIcon/AppIcon';

type Action = {
  icon: IconSource;
  onPress: () => void;
};

interface ActionbarProps {
  active: boolean;
  actions: Action[];
}

export const Actionbar = ({ active, actions }: ActionbarProps) => {
  const theme = useTheme();
  const { bottom } = useScreenInsets();

  if (!active) {
    return null;
  }
  return (
    <Box
      contentAlignment="center"
      modifiers={[fillMaxWidth(), padding(16, 8, 16, 16 + bottom)]}
    >
      <HorizontalFloatingToolbar
        variant="vibrant"
        colors={{
          toolbarContainerColor: theme.primaryContainer,
          toolbarContentColor: theme.onPrimaryContainer,
        }}
      >
        {actions.map(({ icon, onPress }, id) => (
          <IconButtonV2
            key={id}
            name={icon}
            color={theme.onPrimaryContainer}
            onPress={onPress}
            theme={theme}
          />
        ))}
      </HorizontalFloatingToolbar>
    </Box>
  );
};

export default Actionbar;
