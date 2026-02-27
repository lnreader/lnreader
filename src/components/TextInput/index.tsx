import { useTheme } from '@hooks/persisted';
import React, { useState } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  TextInputProps as RNTextInputProps,
} from 'react-native';

interface TextInputProps extends RNTextInputProps {
  error?: boolean;
  value?: never;
}

const TextInput = ({
  onBlur,
  onFocus,
  error,
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

  const borderWidth = inputFocused || error ? 2 : 1;
  const margin = inputFocused || error ? 0 : 1;
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
            : inputFocused
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
