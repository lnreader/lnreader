import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import {
  Host,
  RadioButton as NativeRadioButton,
} from '@expo/ui/jetpack-compose';
import { ThemeColors } from '../../theme/types';

interface Props {
  label: string;
  status: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  theme: ThemeColors;
}

export const RadioButton: React.FC<Props> = ({
  label,
  status,
  onPress,
  style,
  labelStyle,
  theme,
}) => (
  <Pressable
    accessibilityLabel={label}
    accessibilityRole="radio"
    accessibilityState={{ checked: status }}
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.pressable, style]}
    onPress={onPress}
  >
    {/* Display-only: the row Pressable owns touch and ripple, so the radio
        must not draw its own ripple, which gets clipped by the row bounds. */}
    <View
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.radioContainer}
    >
      <Host matchContents>
        <NativeRadioButton
          selected={status}
          colors={{
            selectedColor: theme.primary,
            unselectedColor: theme.onSurfaceVariant,
          }}
        />
      </Host>
    </View>
    <Text style={[styles.label, labelStyle, { color: theme.onSurface }]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  label: {
    flexShrink: 1,
    marginStart: 12,
  },
  pressable: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  radioContainer: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
