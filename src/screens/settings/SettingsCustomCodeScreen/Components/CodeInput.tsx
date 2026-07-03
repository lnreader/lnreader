import React from 'react';
import { PixelRatio, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@hooks/persisted';
import { Row } from '@components/Common';
import { SimpleCodeEditor, MemoizedHighlightedCode } from './SimpleCodeEditor';
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

function LinesRow({
  startNr,
  endNr,
  fake,
  style,
  children,
}: {
  startNr: number;
  endNr: number;
  fake?: boolean;
  style: object;
  children: React.ReactNode;
}) {
  function printLineNumbers(start: number, length: number) {
    const res: number[] = [];
    for (let i = start; i < start + length; i++) {
      res.push(i + 1);
    }
    return res.join('\n');
  }
  const op = { opacity: fake ? 0.4 : 0.7 };
  return (
    <Row style={styles.rowContainer}>
      <Text
        pointerEvents="none"
        style={[style, styles.lines, styles.fontStyle, op]}
      >
        {printLineNumbers(startNr, endNr)}
      </Text>
      {children}
    </Row>
  );
}

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

  const [startLines, setStartLines] = React.useState(0);
  const [endLines, setEndLines] = React.useState(0);

  const [codeLines, setCodeLines] = React.useState(0);
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
          (_, i) => Number(i) + startLines + '',
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
      {/*<LinesRow fake startNr={0} endNr={startLines} style={codeFieldStyle}>*/}
      <MemoizedHighlightedCode
        style={[
          codeFieldStyle,
          styles.fontStyle,
          styles.fakeTextInput,
          styles.topField,
        ]}
        setLineNumbers={setStartLines}
        mode={language}
        value={language === 'js' ? START_JS_CODE : START_CSS_CODE}
      />
      {/*</LinesRow>*/}
      {/*<LinesRow startNr={startLines} endNr={codeLines} style={codeFieldStyle}>*/}
      <SimpleCodeEditor
        placeholder={'Your code here'}
        value={code}
        mode={language}
        onChangeText={setAndAnalyzeCode}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholderTextColor={'grey'}
        setLineNumbers={setCodeLines}
        startLine={startLines}
        style={[codeFieldStyle, styles.fontStyle, styles.codeField]}
      />
      {/*</LinesRow>*/}
      {language !== 'js' ? null : (
        <MemoizedHighlightedCode
          setLineNumbers={setEndLines}
          startLine={startLines + codeLines}
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
