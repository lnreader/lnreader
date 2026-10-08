import { type ColorValue } from 'react-native';
import { Box, Icon } from '@expo/ui/jetpack-compose';
import type { IconSource } from '@type/icon';
import {
  size as sizeModifier,
  type ModifierConfig,
} from '@expo/ui/jetpack-compose/modifiers';

export interface AppIconProps {
  source: IconSource;
  size?: number;
  tint?: ColorValue;
  label?: string;
  modifiers?: ModifierConfig[];
}

// expo-ui's `Icon` takes no space until its vector loads, so it sits in a box
// of its final size and nothing jumps when the glyph appears.
const AppIcon = ({
  source,
  size = 24,
  tint,
  label,
  modifiers,
}: AppIconProps) => (
  <Box
    contentAlignment="center"
    modifiers={[sizeModifier(size, size), ...(modifiers ?? [])]}
  >
    <Icon source={source} size={size} tint={tint} contentDescription={label} />
  </Box>
);

export type { IconSource };

export default AppIcon;
