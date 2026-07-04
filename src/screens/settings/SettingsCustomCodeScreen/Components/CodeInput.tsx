import React from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@hooks/persisted';
import {SimpleCodeEditor, MemoizedHighlightedCode, HighlightMode, useStableLineModels} from './SimpleCodeEditor';
import { Portal } from 'react-native-paper';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

const FONT_SIZE = 14;
const LINE_HEIGHT = Math.ceil(FONT_SIZE * PixelRatio.getFontScale() * 1.2);
const MIN_LINES = 16;

const MD3_DEFAULT_APPBAR_HEIGHT = 64;

type CodeInputProps = {
  language: 'css' | 'js';
  code: string;
  setCode: (code: string) => void;
  highlightMode?: HighlightMode;
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
  highlightMode,
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

  const startValue = language === 'js' ? START_JS_CODE : START_CSS_CODE

  const lines = useStableLineModels(code);
  const startLines = useStableLineModels(startValue);
  const debounce = React.useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = React.useState<string | undefined>(undefined);

  function setAndAnalyzeCode(val: string) {
    if (language === 'js') {
      debounce.current && clearTimeout(debounce.current);
      debounce.current = setTimeout(() => analyzeCode(val), 500);
    }
    setCode(val);
  }
  function analyzeCode(val: string) {
    try {
      // eslint-disable-next-line no-new-func, no-new
      new Function(val);
      setError(undefined);
    } catch (e: unknown) {
      setError(
        (e as Error).message.replace(
          /^(\d+)/,
          (_, i) => Number(i) + startLines.length + '',
        ),
      );
    }
  }

  return (
    <View style={[styles.container]}>
      <Portal>
        {!error ? null : (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={[styles.error, { backgroundColor: theme.errorContainer }]}
          >
            <Text style={[styles.errorText, { color: theme.onErrorContainer }]}>
              {error}
            </Text>
          </Animated.View>
        )}
      </Portal>
      <MemoizedHighlightedCode
        style={[
          codeFieldStyle,
          styles.fontStyle,
          styles.fakeTextInput,
          styles.topField,
        ]}
        mode={language}
        lines={startLines}
      />
      <SimpleCodeEditor
        placeholder={'Your code here'}
        value={code}
        mode={language}
        highlightMode={highlightMode}
        onChangeText={setAndAnalyzeCode}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholderTextColor={'grey'}
        lines={lines}
        startLine={startLines.length}
        style={[codeFieldStyle, styles.fontStyle, styles.codeField]}
      />
      {language !== 'js' ? null : (
        <MemoizedHighlightedCode
          startLine={lines.length + startLines.length}
          style={[styles.fakeTextInput, styles.bottomField, codeFieldStyle]}
          mode={language}
          value={END_JS_CODE}
        />
      )}
    </View>
  );
};
export default CodeInput;

const styles = StyleSheet.create({
  error: {
    width: '100%',
    position: 'absolute',
    top: MD3_DEFAULT_APPBAR_HEIGHT * 1.3,
    padding: 8,
    transform: [{ translateY: 20 }],
    zIndex: 9999,
    backgroundColor: 'red',
  },
  errorText: {
    textAlign: 'center',
  },
  container: {
    flex: 1,
    marginVertical: 8,
    paddingBottom: 8,
  },
  rowContainer: {
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  codeContainer: {
    flex: 1,
  },
  lines: {
    paddingRight: 4,
    paddingTop: 0,
    textAlign: 'right',
    minWidth: 32,
  },
  fontStyle: {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    fontFamily: 'monospace',
    margin: 0,
    marginBottom: 0,
    marginTop: 0,
    padding: 0,
    paddingBottom: 0,
    paddingTop: 0,
  },
  fakeTextInput: {
    opacity: 0.6,
  },
  topField: {
    flex: 1,
  },
  codeField: {
    verticalAlign: 'top',
    paddingTop: 0,
    flex: 1,
    minHeight: LINE_HEIGHT * MIN_LINES,
  },
  bottomField: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
});
