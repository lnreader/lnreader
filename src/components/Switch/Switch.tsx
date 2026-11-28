import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Host, Switch as NativeSwitch } from '@expo/ui/jetpack-compose';
import { useTheme } from '@hooks/persisted';

interface SwitchProps {
  accessible?: boolean;
  accessibilityLabel?: string;
  containerStyle?: StyleProp<ViewStyle>;
  value: boolean;
  onValueChange?: () => void;
  style?: StyleProp<ViewStyle>;
}

const Switch = ({
  accessible = true,
  accessibilityLabel,
  containerStyle,
  value,
  onValueChange,
  style,
}: SwitchProps) => {
  const theme = useTheme();

  return (
    <Pressable
      accessible={accessible}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessible ? 'switch' : undefined}
      accessibilityState={accessible ? { checked: value } : undefined}
      style={containerStyle}
      onPress={onValueChange}
    >
      {/* Display-only: the Pressable owns touch and accessibility so callers
          keep a single press handler and the switch never toggles on its own. */}
      <View
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={[styles.track, style]}
      >
        <Host matchContents>
          <NativeSwitch
            value={value}
            colors={{
              checkedThumbColor: theme.onPrimary,
              checkedTrackColor: theme.primary,
              checkedBorderColor: theme.primary,
              uncheckedThumbColor: theme.outline,
              uncheckedTrackColor: theme.surfaceVariant,
              uncheckedBorderColor: theme.outline,
            }}
          />
        </Host>
      </View>
    </Pressable>
  );
};

export default React.memo(Switch);

const styles = StyleSheet.create({
  // Reserve the MD3 switch footprint so rows don't jump before Compose measures.
  track: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    minWidth: 52,
  },
});
