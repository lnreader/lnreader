import React, { useRef, useState } from 'react';
import {
  PixelRatio,
  StyleSheet,
  TextInput as RNTextInput,
  useWindowDimensions,
} from 'react-native';
import { useAnimatedStyle } from 'react-native-reanimated';
import { useAnimatedKeyboard } from 'react-native-keyboard-controller';
import { useTheme } from '@hooks/persisted';
import { Row } from '@components/Common';
import { Text } from 'react-native-gesture-handler';

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

const CodeInput = ({
  language,
  code,
  setCode,
  onFocus,
  onBlur,
}: CodeInputProps) => {
  const theme = useTheme();

  const codeFieldStyle = React.useMemo(
    () => ({
      color: theme.onBackground,
      backgroundColor: theme.background,
    }),
    [theme],
  );

  function printLineNumbers(start: number, length: number) {
    const res: number[] = [];
    for (let i = start; i < start + length; i++) {
      res.push(i + 1);
    }
    return res.join('\n');
  }

  const [lines, setLines] = useState(0);

  return (
    <>
      <Row>
        <Text style={[styles.fakeTextInput, styles.lines, codeFieldStyle]}>
          {printLineNumbers(0, lines)}
        </Text>
        <Text
          style={[styles.fakeTextInput, styles.topField, codeFieldStyle]}
          onTextLayout={e => setLines(e.nativeEvent.lines.length)}
        >
          {language === 'js' ? START_JS_CODE : START_CSS_CODE}
        </Text>
      </Row>
      <RNTextInput
        placeholder={'Your code here'}
        defaultValue={code}
        onChangeText={setCode}
        onFocus={onFocus}
        onBlur={onBlur}
        multiline
        autoCorrect={false}
        autoCapitalize={'none'}
        placeholderTextColor={'grey'}
        style={[codeFieldStyle, styles.codeField]}
      />
      <Text style={[styles.fakeTextInput, styles.bottomField, codeFieldStyle]}>
        {language === 'js' ? END_JS_CODE : ''}
      </Text>
    </>
  );
};
export default CodeInput;

const styles = StyleSheet.create({
  lines: {
    paddingRight: 4,
    textAlign: 'right',
  },
  fakeTextInput: {
    paddingVertical: 8,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    opacity: 0.6,
  },
  topField: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    flexGrow: 1,
  },
  codeField: {
    verticalAlign: 'top',
    flexGrow: 1,
    borderRadius: 0,
    borderTopWidth: 0,
    borderBottomWidth: 0,
    minHeight: LINE_HEIGHT * 8,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bottomField: {
    flexGrow: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
});
