import { ThemeColors } from '@theme/types';
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { RadioButton as MaterialRadioButton } from 'react-native-paper';

interface RadioButtonGroupProps {
  children?: React.ReactNode;
  value: string | number;
  onValueChange: (value: string) => void;
}

interface RadioButtonProps {
  value: string | number;
  label: string;
  theme: ThemeColors;
  labelStyle?: StyleSheet.AbsoluteFillStyle;
}

export const RadioButtonGroup = ({
  children,
  value,
  onValueChange,
}: RadioButtonGroupProps) => (
  <MaterialRadioButton.Group
    onValueChange={onValueChange}
    value={String(value)}
  >
    {children}
  </MaterialRadioButton.Group>
);

export const RadioButton = ({
  value,
  label,
  theme,
  labelStyle,
}: RadioButtonProps) => (
  <View style={styles.radioButtonContainer}>
    <MaterialRadioButton
      value={String(value)}
      color={theme.primary}
      uncheckedColor={theme.onSurfaceVariant}
    />
    <Text
      style={[styles.radioButtonLabel, { color: theme.onSurface }, labelStyle]}
    >
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  radioButtonContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  radioButtonLabel: {
    fontSize: 16,
    marginStart: 16,
  },
});
