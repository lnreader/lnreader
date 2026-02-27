import { TextInput } from '@components';
import { WINDOW_HEIGHT } from '@gorhom/bottom-sheet';
import React from 'react';
import { PixelRatio, StyleSheet } from 'react-native';
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import { getRuntimeKind } from 'react-native-worklets';
import { useTheme } from '@hooks/persisted';

const FONT_SIZE = 14;
const LINE_HEIGHT = FONT_SIZE * PixelRatio.getFontScale() * 1.2;

type CodeInputProps = {
  language: 'css' | 'js';
  code: string;
  setCode: (code: string) => void;
  error?: boolean;
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

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const CodeInput = ({ language, code, setCode, error }: CodeInputProps) => {
  const theme = useTheme();
  const TextInputRef = useAnimatedRef();
  const { height: keyboardHeight } = useAnimatedKeyboard();
  const expanded = useSharedValue(0);

  const maxHeight = useAnimatedStyle(() => {
    let m: { height: number; pageY: number } | null = null;
    if (getRuntimeKind() !== 1) {
      try {
        m = measure(TextInputRef);
      } catch {}
    }

    if (!m || !keyboardHeight.value) {
      return { maxHeight: WINDOW_HEIGHT / 2 };
    }
    return {
      maxHeight: Math.min(
        Math.max(WINDOW_HEIGHT - keyboardHeight.value - m.pageY, 300),
        WINDOW_HEIGHT / 2,
      ),
    };
  });
  const maxHeightTop = useAnimatedStyle(() => {
    if (expanded.value !== 1) {
      return { maxHeight: withTiming(2 * LINE_HEIGHT + 18, { duration: 250 }) };
    }
    return { maxHeight: withTiming(WINDOW_HEIGHT / 2, { duration: 250 }) };
  }, [expanded]);
  const maxHeightBottom = useAnimatedStyle(() => {
    if (expanded.value !== 2) {
      return { maxHeight: withTiming(2 * LINE_HEIGHT + 18, { duration: 250 }) };
    }
    return { maxHeight: withTiming(WINDOW_HEIGHT / 2, { duration: 250 }) };
  });

  const codeColor = React.useMemo(
    () => ({ borderColor: theme.outline, color: theme.onSurfaceDisabled }),
    [theme],
  );

  return (
    <>
      <Animated.Text
        style={[styles.fakeTextInput, styles.topField, codeColor, maxHeightTop]}
        onPress={() => {
          if (expanded.value === 1) {
            expanded.value = 0;
          } else {
            expanded.value = 1;
          }
        }}
      >
        {language === 'js' ? START_JS_CODE : START_CSS_CODE}
      </Animated.Text>
      <AnimatedTextInput
        ref={TextInputRef}
        placeholder={'Your code here'}
        defaultValue={code}
        onChangeText={setCode}
        multiline
        autoCorrect={false}
        autoCapitalize={'none'}
        style={[styles.codeField, maxHeight]}
        onPress={() => {
          expanded.value = 0;
        }}
        error={error}
      />
      <Animated.Text
        style={[
          styles.fakeTextInput,
          styles.bottomField,
          codeColor,
          maxHeightBottom,
        ]}
        onPress={() => {
          if (expanded.value === 2) {
            expanded.value = 0;
          } else {
            expanded.value = 2;
          }
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
  },
  bottomField: {
    flexGrow: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderTopWidth: 0,
  },
});
