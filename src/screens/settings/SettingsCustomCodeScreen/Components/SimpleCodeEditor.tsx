import React, { useMemo, useRef } from 'react';
import { TextInput, TextProps, Text, TextInputProps } from 'react-native';

const MAX_HIGHLIGHT_CACHE_ENTRIES = 30;

const JS_TOKEN_REGEX = new RegExp(
  `(${[
    '"(?:\\\\.|[^"\\\\])*"',
    "'(?:\\\\.|[^'\\\\])*'",
    '`(?:\\\\.|[^`\\\\])*`',
    '\\/\\/.+',
    '\\/\\*.*\\*\\/',
    '\\/(?![/*])(?:\\\\.|[^/\\n\\\\])+\\/[dgimsuvy]*',
    '[A-Za-z_$][A-Za-z0-9_$]*',
    '[\\[\\]{}()^$?.!:,;=+\\-*<>&|~]+',
    '\\/',
  ].join('|')})`,
  'g',
);

const JS_REGEX_LITERAL = /^\/(?![*/])(?:\\.|[^/\n\\])+\/[dgimsuvy]*$/;

const JS_PUNCTUATION = /^[\[\]{}()^$?.!:,;=+\-*/<>&|~]+$/;

const JS_EXACT_TOKEN_TYPES = new Map([
  ['const', 'keyword'],
  ['let', 'keyword'],
  ['var', 'keyword'],
  ['function', 'keyword'],
  ['return', 'keyword'],
  ['if', 'keyword'],
  ['else', 'keyword'],
  ['import', 'keyword'],
  ['from', 'keyword'],
  ['class', 'keyword'],
  ['extends', 'keyword'],
  ['undefined', 'keyword'],
  ['null', 'keyword'],

  ['document', 'identifier'],
  ['window', 'identifier'],
  ['console', 'identifier'],
]);

const styleMap = {
  keyword: {
    color: '#c678dd',
  },
  identifier: {
    color: '#61afef',
  },
  string: {
    color: '#98c379',
  },
  regexLiteral: {
    color: '#d19a66',
  },
  punctuation: {
    color: '#5c6370',
  },
  normalText: {
    color: '#abb2bf',
  },
} as const;
type TokenType = keyof typeof styleMap;

const CSS_TOKEN_REGEX = new RegExp(
  `(${[
    '\\/\\*.*?\\*\\/',
    '\\.[a-zA-Z0-9_-]+',
    '#[a-zA-Z0-9_-]+',
    '\\b[a-zA-Z-]+\\s*(?=:)',
    ':[^;{}]+',
    '[{};]',
  ].join('|')})`,
  'g',
);

const CSS_PROPERTY = /^\b[a-zA-Z-]+\s*(?=:)$/;

function classifyJsPart(part: string): TokenType {
  const exactTokenType = JS_EXACT_TOKEN_TYPES.get(part);

  if (exactTokenType) {
    return exactTokenType as TokenType;
  }

  switch (part[0]) {
    case '"':
    case "'":
    case '`':
      return 'string';

    case '/':
      if (
        part.startsWith('//') ||
        (part.startsWith('/*') && part.endsWith('*/'))
      ) {
        return 'punctuation';
      }
      if (JS_REGEX_LITERAL.test(part)) {
        return 'regexLiteral';
      }

      return 'punctuation';

    default:
      if (JS_PUNCTUATION.test(part)) {
        return 'punctuation';
      }

      return 'normalText';
  }
}

function classifyCssPart(part: string): TokenType {
  if (part.startsWith('/*') && part.endsWith('*/')) {
    return 'punctuation';
  }

  switch (part[0]) {
    case '.':
    case '#':
      return 'identifier';

    case ':':
      return 'string';

    case '{':
    case '}':
    case ';':
      return 'punctuation';

    default:
      if (CSS_PROPERTY.test(part)) {
        return 'keyword';
      }

      return 'normalText';
  }
}

function renderHighlightedParts(
  parts: string[],
  mode: string,
): React.ReactNode[] {
  return parts
    .filter(p => !!p)
    .map((part, index): React.ReactNode => {
      const tokenType =
        mode === 'js' ? classifyJsPart(part) : classifyCssPart(part);

      return (
        <Text key={index} style={styleMap[tokenType]}>
          {part}
        </Text>
      );
    });
}

function highlightSyntax(text: string, mode: string) {
  switch (mode) {
    case 'js':
      return renderHighlightedParts(text.split(JS_TOKEN_REGEX), mode);

    case 'css':
      return renderHighlightedParts(text.split(CSS_TOKEN_REGEX), mode);

    default:
      return [<Text key="text">{text}</Text>];
  }
}

type SimpleCodeEditor = Omit<
  TextInputProps,
  'value' | 'defaultValue' | 'children'
> & {
  mode: 'js' | 'css';
  value: string;
};
type HighlightedCode = Omit<
  TextProps,
  'value' | 'defaultValue' | 'children'
> & {
  mode: 'js' | 'css';
  value: string;
};

export function HighlightedCode({ value, mode, ...props }: HighlightedCode) {
  return <Text {...props}>{highlightSyntax(value, mode)}</Text>;
}

export function SimpleCodeEditor({ mode, value, ...props }: SimpleCodeEditor) {
  const highlightCacheRef = useRef(new Map());

  const highlightedCode = useMemo(() => {
    const cache = highlightCacheRef.current;
    const cacheKey = `${mode}\0${value}`;

    if (cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);

      cache.delete(cacheKey);
      cache.set(cacheKey, cached);

      return cached;
    }

    const highlighted = highlightSyntax(value, mode);

    cache.set(cacheKey, highlighted);

    if (cache.size > MAX_HIGHLIGHT_CACHE_ENTRIES) {
      const oldestKey = cache.keys().next().value;

      if (oldestKey !== undefined) {
        cache.delete(oldestKey);
      }
    }

    return highlighted;
  }, [value, mode]);

  return (
    <TextInput
      multiline
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      scrollEnabled={false}
      {...props}
    >
      {highlightedCode}
    </TextInput>
  );
}
