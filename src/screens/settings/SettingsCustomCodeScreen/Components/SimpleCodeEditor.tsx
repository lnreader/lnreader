import { Row } from '@components/Common';
import React, { memo, useCallback, useMemo, useRef } from 'react';
import {
  AnimatableNumericValue,
  Animated,
  ColorValue,
  PixelRatio,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { PrismLight as Light } from 'react-syntax-highlighter';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import materialDark from 'react-syntax-highlighter/dist/esm/styles/prism/material-dark';
import materialLight from 'react-syntax-highlighter/dist/esm/styles/prism/material-light';

Light.registerLanguage('javascript', js);
Light.registerLanguage('css', css);

const LANG_MAP = {
  js: 'javascript',
  css: 'css',
} as const;

type SupportedMode = keyof typeof LANG_MAP;
type HLStyleValue = string | number;
type HLStyle = Record<string, HLStyleValue>;
type RNStylesheet = Record<string, TextStyle>;

interface RendererNode {
  type?: 'element' | 'text';
  value?: string | number;
  properties?: {
    className?: string[];
    [key: string]: unknown;
  };
  children?: RendererNode[];
}

export type HighlightMode = 'off' | 'on' | 'combined';

type SimpleCodeEditorProps = Omit<
  TextInputProps,
  'value' | 'defaultValue' | 'children' | 'onChangeText'
> & {
  highlightMode?: HighlightMode;
  onChangeText?: (text: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
};

interface LineModel {
  id: string;
  code: string;
}

interface HighlightedLineProps {
  code: string;
  isDark?: boolean;
  mode: SupportedMode;
  textStyle: TextStyle;
  lineHeight: number;
  hide: boolean;
}

const stylesheetCache = new WeakMap<StyleSheet, RNStylesheet>();

function Passthrough({
  children,
}: {
  children?: React.ReactNode;
  [_key: string]: unknown;
}) {
  return <>{children}</>;
}

function cssToTextStyle(cssStyle: HLStyle): TextStyle {
  const rn: TextStyle = {};

  for (const [key, value] of Object.entries(cssStyle)) {
    switch (key) {
      case 'background':
      case 'backgroundColor':
        rn.backgroundColor = String(value);
        break;

      case 'color':
        rn.color = String(value);
        break;

      case 'fontStyle':
        //rn.fontStyle = value as TextStyle['fontStyle'];
        break;

      case 'fontWeight':
        rn.fontWeight = String(value) as TextStyle['fontWeight'];
        break;

      case 'textDecoration':
      case 'textDecorationLine':
        rn.textDecorationLine = value as TextStyle['textDecorationLine'];
        break;

      default:
        break;
    }
  }

  return rn;
}
type StyleSheet = {
  [key: string]: React.CSSProperties;
};
function getRNStylesheet(stylesheet: StyleSheet): RNStylesheet {
  const cached = stylesheetCache.get(stylesheet);

  if (cached) {
    return cached;
  }

  const rn: RNStylesheet = {};

  for (const [key, value] of Object.entries(stylesheet)) {
    rn[key] = cssToTextStyle(value as HLStyle);
  }

  stylesheetCache.set(stylesheet, rn);

  return rn;
}

function getStylesForNode(
  node: RendererNode,
  rnStylesheet: RNStylesheet,
): TextStyle {
  const result: TextStyle = {};

  for (const className of node.properties?.className ?? []) {
    const classStyle = rnStylesheet[className];

    if (classStyle) {
      Object.assign(result, classStyle);
    }
  }

  return result;
}

function stripLineBreaks(value: string | number): string {
  return String(value).replace(/\r?\n/g, '');
}

function renderInlineNodes(
  nodes: RendererNode[],
  rnStylesheet: RNStylesheet,
  defaultColor: ColorValue,
  keyPrefix = 'n',
): React.ReactNode[] {
  const result: React.ReactNode[] = [];

  nodes.forEach((node, index) => {
    const key = `${keyPrefix}_${index}`;

    if (node.children?.length) {
      result.push(
        <Text
          key={key}
          style={{
            color: defaultColor,
            ...getStylesForNode(node, rnStylesheet),
          }}
        >
          {renderInlineNodes(
            node.children,
            rnStylesheet,
            defaultColor,
            `${key}_c`,
          )}
        </Text>,
      );
    }

    if (node.value != null) {
      result.push(stripLineBreaks(node.value));
    }
  });

  return result;
}

function lineHighlightRenderer(raw: rendererProps): React.ReactNode {
  const { rows, stylesheet } = raw;
  const rnStylesheet = getRNStylesheet(stylesheet);
  const defaultColor = rnStylesheet.hljs?.color ?? '#abb2bf';
  const result: React.ReactNode[] = [];

  rows.forEach((row, rowIndex) => {
    if (row.children?.length) {
      result.push(
        ...renderInlineNodes(
          row.children,
          rnStylesheet,
          defaultColor,
          `r_${rowIndex}`,
        ),
      );
    } else if (row.value != null) {
      result.push(stripLineBreaks(row.value));
    }
  });

  return result;
}

function shallowEqualTextStyle(a: TextStyle, b: TextStyle): boolean {
  const aKeys = Object.keys(a) as Array<keyof TextStyle>;
  const bKeys = Object.keys(b) as Array<keyof TextStyle>;

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every(key => a[key] === b[key]);
}

const HighlightedLine = memo(
  function HighlightedLine({
    code,
    mode,
    isDark = true,
    textStyle,
    lineHeight,
    hide,
  }: HighlightedLineProps) {
    const style = {
      minHeight: lineHeight,
      flex: 1,
      opacity: hide ? 0 : 1,
      lineHeight,
    };
    return (
      <Text style={[textStyle, style]}>
        {code.length === 0 ? (
          '\u200B'
        ) : (
          <Light
            language={LANG_MAP[mode]}
            style={isDark ? materialDark : materialLight}
            PreTag={Passthrough}
            CodeTag={Passthrough}
            renderer={lineHighlightRenderer}
          >
            {code}
          </Light>
        )}
      </Text>
    );
  },
  (prev, next) => {
    return (
      prev.code === next.code &&
      prev.mode === next.mode &&
      prev.lineHeight === next.lineHeight &&
      shallowEqualTextStyle(prev.textStyle, next.textStyle)
    );
  },
);

function splitLines(value: string): string[] {
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
}

export function useStableLineModels(value: string): LineModel[] {
  const previousRef = useRef<{
    lines: string[];
    models: LineModel[];
  } | null>(null);

  const nextIdRef = useRef(0);

  return useMemo(() => {
    const newLines = splitLines(value);
    const previous = previousRef.current;

    if (!previous) {
      const models = newLines.map(line => ({
        id: `line_${nextIdRef.current++}`,
        code: line,
      }));

      previousRef.current = {
        lines: newLines,
        models,
      };

      return models;
    }

    const oldLines = previous.lines;
    const oldModels = previous.models;

    let prefix = 0;

    while (
      prefix < oldLines.length &&
      prefix < newLines.length &&
      oldLines[prefix] === newLines[prefix]
    ) {
      prefix += 1;
    }

    let oldSuffix = oldLines.length - 1;
    let newSuffix = newLines.length - 1;

    while (
      oldSuffix >= prefix &&
      newSuffix >= prefix &&
      oldLines[oldSuffix] === newLines[newSuffix]
    ) {
      oldSuffix -= 1;
      newSuffix -= 1;
    }

    const models: LineModel[] = [];

    for (let i = 0; i < prefix; i += 1) {
      models.push(oldModels[i]);
    }

    for (let i = prefix; i <= newSuffix; i += 1) {
      models.push({
        id: `line_${nextIdRef.current++}`,
        code: newLines[i],
      });
    }

    const suffixCount = oldLines.length - 1 - oldSuffix;

    for (let i = suffixCount; i > 0; i -= 1) {
      const oldIndex = oldLines.length - i;
      models.push(oldModels[oldIndex]);
    }

    previousRef.current = {
      lines: newLines,
      models,
    };

    return models;
  }, [value]);
}

function extractOpacityStyle(style: StyleProp<TextStyle>): {
  opacity: AnimatableNumericValue;
} {
  const flat = StyleSheet.flatten(style) ?? {};

  return {
    opacity: flat.opacity ?? 1,
  };
}

function extractTextStyle(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};

  return {
    color: '#abb2bf',
    fontFamily: flat.fontFamily,
    fontSize: flat.fontSize,
    fontStyle: flat.fontStyle,
    fontWeight: flat.fontWeight,
    letterSpacing: flat.letterSpacing,
    lineHeight: flat.lineHeight,
  };
}

function extractContentPadding(style: StyleProp<TextStyle>): ViewStyle {
  const flat = StyleSheet.flatten(style) ?? {};

  return {
    padding: flat.padding,
    paddingBottom: flat.paddingBottom,
    paddingEnd: flat.paddingEnd,
    paddingHorizontal: flat.paddingHorizontal,
    paddingLeft: flat.paddingLeft,
    paddingRight: flat.paddingRight,
    paddingStart: flat.paddingStart,
    paddingTop: flat.paddingTop,
    paddingVertical: flat.paddingVertical,
  };
}

function getLineHeight(style: StyleProp<TextStyle>): number {
  const flat = StyleSheet.flatten(style) ?? {};

  if (typeof flat.lineHeight === 'number') {
    return flat.lineHeight;
  }

  if (typeof flat.fontSize === 'number') {
    return Math.ceil(flat.fontSize * 1.4);
  }

  return 20;
}

type _MemoizedHighlightedCode<Lines extends boolean> = (Lines extends false
  ? { value: string; lines?: never }
  : { lines: LineModel[]; value?: never }) & {
  mode: SupportedMode;
  style?: StyleProp<TextStyle>;
  hide?: boolean;
  isDark?: boolean;
  setLines?: (num: number) => void;
  startLine?: number;
};
export type MemoizedHighlightedCode =
  | _MemoizedHighlightedCode<true>
  | _MemoizedHighlightedCode<false>;

export function MemoizedHighlightedCode({
  lines,
  value,
  mode,
  style,
  hide,
  setLines,
  isDark = false,
  startLine = 0,
}: MemoizedHighlightedCode) {
  const opacityStyle = useMemo(() => extractOpacityStyle(style), [style]);
  const textStyle = useMemo(() => extractTextStyle(style), [style]);
  const contentPadding = useMemo(() => extractContentPadding(style), [style]);
  const lineHeight = useMemo(() => getLineHeight(style), [style]);
  if (!lines) {
    // Value and lines prop can't be switched
    // eslint-disable-next-line react-hooks/rules-of-hooks
    lines = useStableLineModels(value!);
    setLines?.(lines.length);
  }
  return (
    <View style={[contentPadding, opacityStyle, styles.lineContainer]}>
      {lines.map((line, i) => (
        <Row key={'row' + i + 1 + startLine}>
          <Text key={'l' + i + 1 + startLine} style={[textStyle, styles.lines]}>
            {i + 1 + startLine}
          </Text>

          <HighlightedLine
            key={line.id + hide}
            code={line.code}
            isDark={isDark}
            mode={mode}
            hide={hide ?? false}
            textStyle={textStyle}
            lineHeight={lineHeight}
          />
        </Row>
      ))}
    </View>
  );
}

export function SimpleCodeEditor({
  highlightMode = 'combined',
  onChangeText,
  containerStyle,
  scrollEnabled = true,
  lines,
  value,
  mode,
  style,
  isDark,
  setLines,
  startLine,
  ...props
}: SimpleCodeEditorProps & Omit<MemoizedHighlightedCode, 'hide'>) {
  const hideHighlight = highlightMode === 'off';
  const showInput = highlightMode !== 'on';
  const scrollY = useRef(new Animated.Value(0)).current;

  const highlightedCodeProps = {
    lines,
    value,
    mode,
    style,
    hide: hideHighlight,
    isDark,
    setLines,
    startLine,
  };

  const negativeScrollY = useMemo(() => {
    return Animated.multiply(scrollY, -1);
  }, [scrollY]);

  const handleChangeText = useCallback(
    (text: string) => {
      onChangeText?.(text);
    },
    [onChangeText],
  );

  const color = {
    color: showInput ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.01)',
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          styles.highlightLayer,
          {
            transform: [{ translateY: negativeScrollY }],
          },
        ]}
      >
        {/*@ts-expect-error*/}
        <MemoizedHighlightedCode {...highlightedCodeProps} />
      </Animated.View>
      <TextInput
        {...props}
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        scrollEnabled={scrollEnabled}
        value={value}
        onChangeText={handleChangeText}
        cursorColor="#abb2bf"
        selectionColor="#abb2bf"
        style={[
          style,
          styles.input,
          Platform.OS === 'android' && styles.androidInput,
          color,
          highlightMode === 'off' && styles.inputVisible,
        ]}
      />
    </View>
  );
}

const FONT_SIZE = 14;
const LINE_HEIGHT = Math.ceil(FONT_SIZE * PixelRatio.getFontScale() * 1.2);
const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  highlightLayer: {
    zIndex: 0,
  },
  input: {
    zIndex: 1,
    backgroundColor: 'transparent',
    width: 'auto',
    textAlignVertical: 'top',
    marginLeft: 32,
  },
  inputVisible: {
    color: '#abb2bf',
  },
  androidInput: {
    includeFontPadding: false,
  },
  lines: {
    textAlign: 'right',
    width: 32,
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT,
    height: '100%',
    fontFamily: 'monospace',
    margin: 0,
    marginBottom: 0,
    marginTop: 0,
    padding: 0,
    paddingRight: 4,
    paddingBottom: 0,
    paddingTop: 0,
  },
  lineContainer: { width: '100%', position: 'relative' },
});
