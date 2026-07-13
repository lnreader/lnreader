import { useTheme } from '@hooks/persisted';
import React, { useState } from 'react';
import { StyleSheet, TextInputProps as RNTextInputProps } from 'react-native';
import { TextInput as RNTextInput } from 'react-native-gesture-handler';

interface TextInputProps extends RNTextInputProps {
  error?: boolean;
  value?: never;
  forceFocused?: boolean;
}

const TextInput = ({
  onBlur,
  onFocus,
  error,
  forceFocused,
  style,
  ...props
}: TextInputProps) => {
  const theme = useTheme();

  const [inputFocused, setInputFocused] = useState(false);

  const _onFocus: RNTextInputProps['onFocus'] = e => {
    setInputFocused(true);
    onFocus?.(e);
  };
  const _onBlur: RNTextInputProps['onBlur'] = e => {
    setInputFocused(false);
    onBlur?.(e);
  };

  const isFocused = forceFocused ?? inputFocused;
  const borderWidth = isFocused || error ? 2 : 1;
  const margin = isFocused || error ? 0 : 1;
  return (
    <RNTextInput
      placeholderTextColor={'grey'}
      onFocus={_onFocus}
      onBlur={_onBlur}
      style={[
        {
          color: theme.onBackground,
          backgroundColor: theme.background,
          borderColor: error
            ? theme.error
            : isFocused
            ? theme.primary
            : theme.outline,
          borderWidth: borderWidth,
          margin: margin,
        },
        styles.textInput,
        style,
      ]}
      {...props}
    />
  );
};

export default TextInput;

const styles = StyleSheet.create({
  textInput: {
    borderRadius: 4,
    borderStyle: 'solid',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
