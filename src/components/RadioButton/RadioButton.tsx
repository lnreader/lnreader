import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { RadioButton as PaperRadioButton } from 'react-native-paper';
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
    android_ripple={{ color: theme.rippleColor }}
    style={[styles.pressable, style]}
    onPress={onPress}
  >
    <PaperRadioButton
      status={status ? 'checked' : 'unchecked'}
      value={label}
      onPress={onPress}
      color={theme.primary}
      uncheckedColor={theme.onSurfaceVariant}
    />
    <Text style={[styles.label, labelStyle, { color: theme.onSurface }]}>
      {label}
    </Text>
  </Pressable>
);

const styles = StyleSheet.create({
  icon: {
    alignSelf: 'center',
    start: 24,
    position: 'absolute',
  },
  label: {
    marginStart: 12,
  },
  pressable: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
});
