import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import {
  SimpleCodeEditor,
  MemoizedHighlightedCode,
  HighlightMode,
  ScrollSink,
  useStableLineModels,
  FONT_SIZE,
  LINE_HEIGHT,
} from './SimpleCodeEditor';
import Animated from 'react-native-reanimated';

const MIN_LINES = 16;

type CodeInputProps = {
  language: 'css' | 'js';
  code: string;
  setCode: (code: string) => void;
  highlightMode?: HighlightMode;
  error?: boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  scrollSink?: ScrollSink;
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
  scrollSink,
}: CodeInputProps) => {
  const theme = useTheme();

  const codeFieldStyle = React.useMemo(
    () => ({
      color: theme.onBackground,
      backgroundColor: theme.background,
    }),
    [theme],
  );

  const startValue = language === 'js' ? START_JS_CODE : START_CSS_CODE;

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
      <Animated.View
        style={[
          styles.error,
          {
            backgroundColor: theme.errorContainer,
            maxHeight: error ? 35 : 0,
            padding: error ? 8 : 0,
            transitionProperty: ['maxHeight', 'padding'],
            transitionDuration: '150ms',
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[styles.errorText, { color: theme.onErrorContainer }]}
        >
          {error}
        </Text>
      </Animated.View>

      <MemoizedHighlightedCode
        style={[
          codeFieldStyle,
          styles.fontStyle,
          styles.fakeTextInput,
          styles.topField,
        ]}
        isDark={theme.isDark}
        mode={language}
        lines={startLines}
      />
      <SimpleCodeEditor
        placeholder={getString('customCodeSettings.yourCodeHere')}
        value={code}
        mode={language}
        highlightMode={highlightMode}
        onChangeText={setAndAnalyzeCode}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholderTextColor={'grey'}
        lines={lines}
        startLine={startLines.length}
        isDark={theme.isDark}
        style={[codeFieldStyle, styles.fontStyle, styles.codeField]}
        scrollSink={scrollSink}
      />
      {language !== 'js' ? null : (
        <MemoizedHighlightedCode
          startLine={lines.length + startLines.length}
          style={[styles.fakeTextInput, styles.bottomField, codeFieldStyle]}
          mode={language}
          isDark={theme.isDark}
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
    padding: 8,
    marginBottom: 8,
    backgroundColor: 'red',
  },
  errorText: {
    textAlign: 'center',
  },
  container: {
    flex: 1,
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
