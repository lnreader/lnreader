import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ColorValue,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
  useWindowDimensions,
} from 'react-native';
import Color from 'color';
import { PrismLight as Light } from 'react-syntax-highlighter';
import css from 'react-syntax-highlighter/dist/esm/languages/prism/css';
import js from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import materialDark from 'react-syntax-highlighter/dist/esm/styles/prism/material-dark';
import materialLight from 'react-syntax-highlighter/dist/esm/styles/prism/material-light';

export const FONT_SIZE = 14;
export const LINE_HEIGHT = Math.ceil(FONT_SIZE * 1.2);

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

/** The owning ScrollView registers a callback here that receives contentOffset.y. */
export type ScrollSink = React.MutableRefObject<((y: number) => void) | null>;

type SimpleCodeEditorProps = Omit<
  TextInputProps,
  'value' | 'defaultValue' | 'children' | 'onChangeText'
> & {
  highlightMode?: HighlightMode;
  onChangeText?: (text: string) => void;
  containerStyle?: StyleProp<ViewStyle>;
  scrollSink?: ScrollSink;
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
}

type PrismStylesheet = Record<string, React.CSSProperties>;

interface RendererProps {
  rows: RendererNode[];
  stylesheet: PrismStylesheet;
}

const stylesheetCache = new WeakMap<PrismStylesheet, RNStylesheet>();
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

function getRNStylesheet(stylesheet: PrismStylesheet): RNStylesheet {
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
          allowFontScaling={false}
          style={[
            {
              color: defaultColor,
              includeFontPadding: false,
              ...getStylesForNode(node, rnStylesheet),
            },
          ]}
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

function lineHighlightRenderer(raw: RendererProps): React.ReactNode {
  const { rows, stylesheet } = raw;
  const rnStylesheet = getRNStylesheet(stylesheet);
  const defaultColor =
    rnStylesheet['code[class*="language-"]']?.color ??
    rnStylesheet['pre[class*="language-"]']?.color ??
    '#abb2bf';
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
  const aKeys = Object.keys(a) as (keyof TextStyle)[];
  const bKeys = Object.keys(b) as (keyof TextStyle)[];

  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every(key => a[key] === b[key]);
}

const HighlightedLine = memo(
  function _HighlightedLine({
    code,
    mode,
    isDark,
    textStyle,
  }: HighlightedLineProps) {
    return (
      <Text
        allowFontScaling={false}
        style={[textStyle, styles.codeLine, styles.withoutFontPadding]}
      >
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
  (prev, next) =>
    prev.code === next.code &&
    prev.mode === next.mode &&
    prev.isDark === next.isDark &&
    shallowEqualTextStyle(prev.textStyle, next.textStyle),
);

export function useStableLineModels(value: string): LineModel[] {
  const previousRef = useRef<{
    lines: string[];
    models: LineModel[];
  } | null>(null);

  const nextIdRef = useRef(0);

  return useMemo(() => {
    const newLines = value
      .replace(/\r\n?/g, '\n')
      .split('\n');
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

function extractOpacityStyle(style: StyleProp<TextStyle>) {
  const flat = StyleSheet.flatten(style) ?? {};

  return {
    opacity: flat.opacity ?? 1,
  };
}

function extractTextStyle(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};

  return {
    color: flat.color ?? '#abb2bf',
    fontFamily: flat.fontFamily ?? 'monospace',
    fontSize: typeof flat.fontSize === 'number' ? flat.fontSize : FONT_SIZE,
    fontStyle: flat.fontStyle,
    fontWeight: flat.fontWeight,
    letterSpacing: flat.letterSpacing ?? 0,
    lineHeight:
      typeof flat.lineHeight === 'number' ? flat.lineHeight : LINE_HEIGHT,
  };
}

export type MemoizedHighlightedCodeProps = {
  lines?: LineModel[];
  value?: string;
  mode: SupportedMode;
  style?: StyleProp<TextStyle>;
  hideCode?: boolean;
  isDark?: boolean;
  setLines?: (num: number) => void;
  startLine?: number;
  scrollSink?: ScrollSink;
};

const TOP_OVERS = 6;
const BOTTOM_OVERS = 8;
const CHAR_MEASURE_STENCIL = 'WWWWWWWWWWWWWWWWWWWW';
const GUTTER_WIDTH = 32;

export function MemoizedHighlightedCode({
  lines,
  value,
  mode,
  style,
  hideCode = false,
  setLines,
  isDark = false,
  startLine = 0,
  scrollSink,
}: MemoizedHighlightedCodeProps) {
  // Never call a hook conditionally. Generating this for externally supplied
  // lines is cheap and keeps the hook order valid.
  const generatedLines = useStableLineModels(value ?? '');
  const resolvedLines = lines ?? generatedLines;

  const opacityStyle = useMemo(() => extractOpacityStyle(style), [style]);
  const textStyle = useMemo(() => extractTextStyle(style), [style]);

  const { height: viewportHeight } = useWindowDimensions();

  const layerRef = useRef<View>(null);
  const firstRowRef = useRef<View>(null);
  const lastScrollYRef = useRef<number | null>(null);
  const layerContentYRef = useRef<number | null>(null);
  const viewportHRef = useRef(viewportHeight);
  const charWidthRef = useRef<number | null>(null);
  const containerWidthRef = useRef<number | null>(null);
  const heightsRef = useRef<Map<string, number>>(new Map());
  const linesRef = useRef(resolvedLines);

  linesRef.current = resolvedLines;
  viewportHRef.current = viewportHeight;

  // Without a sink (static previews) the whole list renders, so the window
  // state is inert. With a sink, seed a conservative superset window until
  // the layer position is measured and the exact window is computed.
  const [window, setWindow] = useState<{ start: number; end: number }>(() =>
    scrollSink
      ? {
          start: 0,
          end: Math.min(
            resolvedLines.length,
            Math.ceil(viewportHeight / LINE_HEIGHT) + BOTTOM_OVERS,
          ),
        }
      : { start: 0, end: 0 },
  );
  const [corr, setCorr] = useState(0);

  const estimateHeight = useCallback((line: LineModel): number => {
    const charWidth = charWidthRef.current;
    const containerWidth = containerWidthRef.current;
    if (charWidth == null || containerWidth == null) {
      return LINE_HEIGHT;
    }
    const charsPerLine = Math.max(
      1,
      Math.floor((containerWidth - GUTTER_WIDTH) / charWidth),
    );
    return (
      Math.max(1, Math.ceil(line.code.length / charsPerLine)) * LINE_HEIGHT
    );
  }, []);

  const cumSum = useCallback(
    (count: number): number => {
      const rows = linesRef.current;
      let sum = 0;
      // The window is updated by scroll events, so after a large edit that
      // shrinks the content it can point past the end of the current rows
      // until the next scroll/layout pass. Never read past the array.
      const limit = Math.min(count, rows.length);
      for (let i = 0; i < limit; i += 1) {
        sum += heightsRef.current.get(rows[i].id) ?? estimateHeight(rows[i]);
      }
      return sum;
    },
    [estimateHeight],
  );

  const handleScroll = useCallback(
    (y: number) => {
      lastScrollYRef.current = y;
      const layerY = layerContentYRef.current;
      if (layerY == null) return;
      // layerContentYRef is the layer's window y measured at scroll offset 0
      // (measureInWindow y + scroll y is invariant), so the viewport top
      // relative to the layer grows with the scroll offset.
      const windowY = y - layerY;
      const viewportH = viewportHRef.current;
      const rows = linesRef.current;
      const count = rows.length;
      let cum = 0;
      let W = -1;
      let E = -1;
      for (let i = 0; i < count; i += 1) {
        const h = heightsRef.current.get(rows[i].id) ?? estimateHeight(rows[i]);
        if (W < 0 && cum + h > windowY) W = i; // first line whose bottom is below the viewport top
        if (W >= 0 && cum >= windowY + viewportH) {
          E = i; // first line whose top is below the viewport bottom
          break;
        }
        cum += h;
      }
      if (W < 0) W = count;
      if (E < 0) E = count;
      const start = Math.max(0, W - TOP_OVERS);
      const end = Math.min(count, E + BOTTOM_OVERS);
      setWindow(prev =>
        prev.start === start && prev.end === end ? prev : { start, end },
      );
    },
    [estimateHeight],
  );

  useEffect(() => {
    if (!scrollSink) return;
    scrollSink.current = handleScroll;
    return () => {
      if (scrollSink.current === handleScroll) {
        scrollSink.current = null;
      }
    };
  }, [scrollSink, handleScroll]);

  const measureLayerY = useCallback(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.measureInWindow((_, y) => {
      layerContentYRef.current = y + (lastScrollYRef.current ?? 0);
      handleScroll(lastScrollYRef.current ?? 0);
    });
  }, [handleScroll]);

  // Self-correction: the window's padding must equal the TextInput's true
  // cumulative text height; estimates + native insets leave a residual that
  // this measures directly off the first rendered row and folds into corr.
  useEffect(() => {
    if (!scrollSink) return;
    const first = firstRowRef.current;
    const layer = layerRef.current;
    if (!first || !layer) return;
    layer.measureInWindow((_, ly) => {
      first.measureInWindow((_, fy) => {
        const residual = fy - ly - cumSum(window.start);
        setCorr(prev => (Math.abs(prev - residual) < 0.5 ? prev : residual));
      });
    });
  }, [scrollSink, window.start, lines, cumSum]);

  useEffect(() => {
    setLines?.(resolvedLines.length);
  }, [resolvedLines.length, setLines]);

  // Without a sink the whole list renders (static previews): the window is
  // {0, 0}, so start/end expand to the full list and the row extras are off.
  const start = scrollSink ? window.start : 0;
  const end = scrollSink ? window.end : resolvedLines.length;

  return (
    <View
      ref={layerRef}
      style={[styles.lineContainer, opacityStyle]}
      onLayout={e => {
        containerWidthRef.current = e.nativeEvent.layout.width;
        measureLayerY();
      }}
    >
      <Text
        pointerEvents="none"
        style={[textStyle, styles.withoutFontPadding, styles.charMeasure]}
        onLayout={e => {
          charWidthRef.current =
            e.nativeEvent.layout.width / CHAR_MEASURE_STENCIL.length;
          // The first window computation runs before this measured width is
          // available (single-row estimates); re-derive it now that wrapping
          // can be estimated correctly.
          measureLayerY();
        }}
      >
        {CHAR_MEASURE_STENCIL}
      </Text>
      <View
        style={scrollSink ? { paddingTop: cumSum(start) + corr } : undefined}
      >
        {resolvedLines.slice(start, end).map((line, i) => (
          <View
            key={line.id}
            style={styles.row}
            ref={scrollSink && i === 0 ? firstRowRef : undefined}
            onLayout={
              scrollSink
                ? e => {
                    const h = e.nativeEvent.layout.height;
                    if (heightsRef.current.get(line.id) !== h) {
                      heightsRef.current.set(line.id, h);
                    }
                  }
                : undefined
            }
          >
            <LineRenderer
              line={line}
              index={i + start}
              isDark={isDark}
              mode={mode}
              startLine={startLine}
              textStyle={textStyle}
              hideCode={hideCode}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const LineRenderer = memo(
  ({
    line,
    index,
    mode,
    startLine,
    textStyle,
    isDark,
    hideCode,
  }: {
    line: LineModel;
    index: number;
    startLine: number;
    mode: SupportedMode;
    textStyle: TextStyle;
    isDark: boolean;
    hideCode: boolean;
  }) => {
    return (
      <>
        <Text
          allowFontScaling={false}
          style={[textStyle, styles.lineNumber, styles.withoutFontPadding]}
        >
          {index + 1 + startLine}
        </Text>
        {hideCode ? null : (
          <HighlightedLine
            code={line.code}
            isDark={isDark}
            mode={mode}
            textStyle={textStyle}
          />
        )}
      </>
    );
  },
  (prev, next) =>
    prev.line.code === next.line.code &&
    prev.index === next.index &&
    prev.startLine === next.startLine &&
    prev.mode === next.mode &&
    prev.isDark === next.isDark &&
    prev.hideCode === next.hideCode &&
    shallowEqualTextStyle(prev.textStyle, next.textStyle),
);

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
  scrollSink,
  ...props
}: SimpleCodeEditorProps & Omit<MemoizedHighlightedCodeProps, 'hideCode'>) {
  const hideHighlight = highlightMode === 'off';

  const textStyle = useMemo(() => extractTextStyle(style), [style]);

  const inputColor =
    highlightMode === 'off'
      ? textStyle.color
      : highlightMode === 'combined'
      ? Color(textStyle.color).alpha(0.4).string()
      : 'rgba(0, 0, 0, 0.1)';

  return (
    <View style={[styles.container, containerStyle]}>
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.highlightLayer]}
      >
        <MemoizedHighlightedCode
          lines={lines}
          value={value}
          mode={mode}
          style={style}
          hideCode={hideHighlight}
          isDark={isDark}
          setLines={setLines}
          startLine={startLine}
          scrollSink={scrollSink}
        />
      </View>

      <TextInput
        {...props}
        multiline
        allowFontScaling={false}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        scrollEnabled={scrollEnabled}
        underlineColorAndroid="transparent"
        value={value}
        onChangeText={onChangeText}
        cursorColor="#abb2bf"
        selectionColor="#abb2bf"
        style={[
          style,
          styles.input,
          textStyle,
          {
            color: inputColor,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  highlightLayer: {
    zIndex: 0,
  },
  lineContainer: {
    position: 'relative',
    width: '100%',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  lineNumber: {
    width: GUTTER_WIDTH,
    flexShrink: 0,
    margin: 0,
    padding: 0,
    paddingRight: 4,
    textAlign: 'right',
  },
  codeLine: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    padding: 0,
  },
  input: {
    zIndex: 1,
    width: '100%',
    margin: 0,
    borderWidth: 0,
    padding: 0,
    paddingLeft: GUTTER_WIDTH,
    backgroundColor: 'transparent',
    textAlignVertical: 'top',
    includeFontPadding: false,
  },
  charMeasure: {
    position: 'absolute',
    opacity: 0,
  },
  withoutFontPadding: {
    includeFontPadding: false,
  },
});
