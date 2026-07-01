import React from 'react';
import {
  PixelRatio,
  StyleSheet,
  TextInput as RNTextInput,
  Text,
  View,
} from 'react-native';
import { useTheme } from '@hooks/persisted';
import { Row } from '@components/Common';

const FONT_SIZE = 14;
const LINE_HEIGHT = FONT_SIZE * PixelRatio.getFontScale() * 1.2;
const MIN_LINES = 16;

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

  return (
    <Row style={styles.rowContainer}>
      <Text
        pointerEvents="none"
        style={[
          { opacity: fake ? 0.4 : 0.7 },
          style,
          styles.lines,
          styles.fontStyle,
        ]}
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

  return (
    <View style={[styles.container]}>
      <LinesRow fake startNr={0} endNr={startLines} style={codeFieldStyle}>
        <Text
          pointerEvents="none"
          style={[
            codeFieldStyle,
            styles.fontStyle,
            styles.fakeTextInput,
            styles.topField,
          ]}
          onTextLayout={e => setStartLines(e.nativeEvent.lines.length)}
        >
          {language === 'js' ? START_JS_CODE : START_CSS_CODE}
        </Text>
      </LinesRow>
      <LinesRow startNr={startLines} endNr={codeLines} style={codeFieldStyle}>
        <RNTextInput
          placeholder={'Your code here'}
          defaultValue={code}
          onChangeText={setCode}
          onFocus={onFocus}
          onBlur={onBlur}
          multiline
          scrollEnabled={false}
          autoCorrect={false}
          autoCapitalize={'none'}
          placeholderTextColor={'grey'}
          onContentSizeChange={e => {
            const l = e.nativeEvent.contentSize.height / LINE_HEIGHT;
            setCodeLines(Math.max(Math.floor(l), MIN_LINES));
          }}
          style={[codeFieldStyle, styles.fontStyle, styles.codeField]}
        />
      </LinesRow>
      {language !== 'js' ? null : (
        <LinesRow
          fake
          startNr={startLines + codeLines}
          endNr={endLines}
          style={codeFieldStyle}
        >
          <Text
            onTextLayout={e => {
              const l = e.nativeEvent.lines.length;
              setEndLines(l);
            }}
            style={[styles.fakeTextInput, styles.bottomField, codeFieldStyle]}
          >
            {END_JS_CODE}
          </Text>
        </LinesRow>
      )}
    </View>
  );
};
export default CodeInput;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginVertical: 8,
    paddingBottom: 8,
  },
  rowContainer: {
    paddingVertical: 8,
  },
  codeContainer: {
    flex: 1,
  },
  lines: {
    paddingRight: 4,
    textAlign: 'right',
  },
  fontStyle: {
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    fontFamily: 'monospace',
    margin: 0,
    padding: 0,
  },
  fakeTextInput: {
    opacity: 0.6,
  },
  topField: {
    marginBottom: 0,
    paddingBottom: 0,
    flex: 1,
  },
  codeField: {
    verticalAlign: 'top',
    flex: 1,
    minHeight: LINE_HEIGHT * MIN_LINES,
  },
  bottomField: {
    flex: 1,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
});
