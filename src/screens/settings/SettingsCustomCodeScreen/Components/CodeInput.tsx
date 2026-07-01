import React from 'react';
import {
  PixelRatio,
  StyleSheet,
  TextInput as RNTextInput,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import { useTheme } from '@hooks/persisted';

const FONT_SIZE = 14;
const LINE_HEIGHT = FONT_SIZE * PixelRatio.getFontScale() * 1.2;

type CodeInputProps = {
  language: 'css' | 'js';
  code: string;
  setCode: (code: string) => void;
  error?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
};

const START_JS_CODE = `const qs = (s) => document.querySelector(s);
let html = qs("#LNReader-chapter").innerHTML;`;
const START_CSS_CODE = `:root {
  --StatusBar-currentHeight: number px;
  --readerSettings-theme: color;
  --readerSettings-padding: number px;
  --readerSettings-textSize: number px;
  --readerSettings-textColor: color;
  --readerSettings-textAlign: alignment;
  --readerSettings-lineHeight: number;
  --readerSettings-fontFamily: font;
  --theme-primary: color;
  --theme-onPrimary: color;
  --theme-secondary: color;
  --theme-tertiary: color;
  --theme-onTertiary: color;
  --theme-onSecondary: color;
  --theme-surface: color;
  --theme-surface-0-9: color;
  --theme-onSurface: color;
  --theme-surfaceVariant: color;
  --theme-onSurfaceVariant: color;
  --theme-outline: color;
  --theme-rippleColor: color;
}`;
const END_JS_CODE = 'qs("#LNReader-chapter").innerHTML = html;';

const AnimatedTextInput = Animated.createAnimatedComponent(RNTextInput);

const CodeInput = ({
  language,
  code,
  setCode,
  error,
  onFocus,
  onBlur,
}: CodeInputProps) => {
  const theme = useTheme();
  const { height: keyboardHeight } = useAnimatedKeyboard();
  const expanded = useSharedValue(0);
  const { height: windowHeight } = useWindowDimensions();

  const [inputFocused, setInputFocused] = React.useState(false);

  const handleFocus = () => {
    setInputFocused(true);
    onFocus?.();
  };
  const handleBlur = () => {
    setInputFocused(false);
    onBlur?.();
  };

  const isFocused = inputFocused;
  const borderWidth = isFocused || error ? 2 : 1;
  const margin = isFocused || error ? 0 : 1;

  const maxHeight = useAnimatedStyle(() => {
    const availableHeight = windowHeight - keyboardHeight.value - 200;
    return {
      maxHeight: Math.min(Math.max(availableHeight, 300), windowHeight / 2),
    };
  });
  const maxHeightTop = useAnimatedStyle(() => {
    if (expanded.value !== 1) {
      return { maxHeight: withTiming(2 * LINE_HEIGHT + 18, { duration: 250 }) };
    }
    return { maxHeight: withTiming(windowHeight / 2, { duration: 250 }) };
  }, [expanded]);
  const maxHeightBottom = useAnimatedStyle(() => {
    if (expanded.value !== 2) {
      return { maxHeight: withTiming(2 * LINE_HEIGHT + 18, { duration: 250 }) };
    }
    return { maxHeight: withTiming(windowHeight / 2, { duration: 250 }) };
  });

  const codeColor = React.useMemo(
    () => ({ borderColor: theme.outline, color: theme.onSurfaceDisabled }),
    [theme],
  );

  const codeFieldStyle = React.useMemo(
    () => ({
      color: theme.onBackground,
      backgroundColor: theme.background,
      borderColor: error
        ? theme.error
        : isFocused
        ? theme.primary
        : theme.outline,
      borderWidth,
      margin,
    }),
    [theme, error, isFocused, borderWidth, margin],
  );

  return (
    <>
      <Animated.Text
        style={[styles.fakeTextInput, styles.topField, codeColor, maxHeightTop]}
        onPress={() => {
          expanded.value = expanded.value === 1 ? 0 : 1;
        }}
      >
        {language === 'js' ? START_JS_CODE : START_CSS_CODE}
      </Animated.Text>
      <AnimatedTextInput
        {...({ nestedScrollEnabled: true } as any)}
        placeholder={'Your code here'}
        defaultValue={code}
        onChangeText={setCode}
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline
        autoCorrect={false}
        autoCapitalize={'none'}
        placeholderTextColor={'grey'}
        style={[codeFieldStyle, styles.codeField, maxHeight]}
      />
      <Animated.Text
        style={[
          styles.fakeTextInput,
          styles.bottomField,
          codeColor,
          maxHeightBottom,
        ]}
        onPress={() => {
          expanded.value = expanded.value === 2 ? 0 : 2;
        }}
      >
        {language === 'js' ? END_JS_CODE : ''}
      </Animated.Text>
    </>
  );
};

export default CodeInput;

const styles = StyleSheet.create({
  fakeTextInput: {
    borderRadius: 4,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 1,
    marginVertical: 2,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
  },
  topField: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    borderBottomWidth: 0,
    flexGrow: 1,
  },
  codeField: {
    verticalAlign: 'top',
    flexGrow: 1,
    borderRadius: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    minHeight: LINE_HEIGHT * 8,
    borderStyle: 'solid',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bottomField: {
    flexGrow: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
});
