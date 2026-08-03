import { Pressable, StyleProp, ViewStyle } from 'react-native';
import React from 'react';
import { Switch as ComposeSwitch } from '@expo/ui/jetpack-compose';
import { useTheme } from '@hooks/persisted';
import { ExpoHost, getSwitchColors } from '@components/ExpoUI';

interface SwitchProps {
  accessible?: boolean;
  value: boolean;
  onValueChange?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Compose Switch is purely visual here (`pointerEvents="none"`); the
 * wrapping Pressable is the single source of touch handling, matching the
 * previous Reanimated-based implementation where the whole control was one
 * Pressable rather than a separately-clickable thumb/track.
 */
const Switch = ({
  accessible = true,
  value,
  onValueChange,
  style,
}: SwitchProps) => {
  const theme = useTheme();

  return (
    <Pressable accessible={accessible} onPress={onValueChange} testID="switch">
      <ExpoHost theme={theme} style={style} matchContents pointerEvents="none">
        <ComposeSwitch value={value} colors={getSwitchColors(theme)} />
      </ExpoHost>
    </Pressable>
  );
};

export default React.memo(Switch);
