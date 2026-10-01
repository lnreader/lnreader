import { fontFaceCss, fontFamilyValue } from './fonts';
import type { ReaderPreferences } from './preferences';

export interface ReaderStyles {
  /** Prepended to each chapter's head: defaults the chapter may override. */
  before: string;
  /** Appended to each chapter's head: the reader's choices, which win. */
  after: string;
}

export const HIGHLIGHTS = {
  search: 'ln-search',
  searchCurrent: 'ln-search-current',
  tts: 'ln-tts',
  ttsTarget: 'ln-tts-target',
} as const;

const px = (value: number) => `${Math.round(value * 100) / 100}px`;
const em = (value: number) => `${Math.round(value * 1000) / 1000}em`;
const SCROLLED_PADDING = { top: 24, bottom: 40 };

/** Rejects values that could close a declaration or rule. */
const safeColor = (value: string, fallback: string) =>
  /^[#\w\s(),.%-]+$/.test(value) ? value : fallback;

const safeValue = (value: string) => /^[#\w\s(),.%"'-]+$/.test(value);

/** Custom CSS has always been able to use these. */
const variablesCss = (variables: Record<string, string>) => {
  const declarations = Object.entries(variables)
    .filter(([name, value]) => /^[\w-]+$/.test(name) && safeValue(value))
    .map(([name, value]) => `--${name}: ${value};`);
  return declarations.length ? `:root { ${declarations.join(' ')} }` : '';
};

// `@import url(...) ...;` or `@import "...";`, up to the closing semicolon.
const IMPORT_RULE =
  /@import\s+(?:url\((?:[^)"']|"[^"]*"|'[^']*')*\)|"[^"]*"|'[^']*')[^;]*;/gi;

/**
 * Chapters come from many sites, so the typography is forced with
 * `!important` on text elements; images, tables and code keep theirs.
 */
export const buildReaderStyles = (
  prefs: ReaderPreferences,
  assetsUri: string,
): ReaderStyles => {
  const background = safeColor(prefs.backgroundColor, '#292832');
  const text = safeColor(prefs.textColor, '#CCCCCC');
  // Custom properties don't resolve inside ::highlight, so values are written out.
  const primary = safeColor(prefs.cssVariables['theme-primary'] ?? text, text);
  const secondary = safeColor(
    prefs.cssVariables['theme-secondary'] ?? primary,
    primary,
  );
  const onSecondary = safeColor(
    prefs.cssVariables['theme-onSecondary'] ?? background,
    background,
  );
  const family = fontFamilyValue(prefs.fontFamily);
  const textAlign = prefs.textAlign === 'start' ? 'start' : prefs.textAlign;
  const textBlocks = 'p, li, dd, dt, blockquote, div, span, font, td, th';

  // `@import` only counts at the very start of a stylesheet, and custom CSS
  // goes at the end of one, so its imports (e.g. a web font) move to the top.
  const imports: string[] = [];
  const customCss = prefs.customCss.replace(IMPORT_RULE, rule => {
    imports.push(rule);
    return '';
  });

  const before = `${imports.join('\n')}
${fontFaceCss(prefs.fontFamily, assetsUri)}
${variablesCss(prefs.cssVariables)}
img, svg, video, canvas { max-width: 100%; height: auto; }
img { display: block; }
table { border-collapse: collapse; max-width: 100%; }
td { padding: 10px; text-align: center; }
table, th, td { border: 1px solid currentColor; }
pre { white-space: pre-wrap; overflow-wrap: anywhere; }
hr { margin: 20px 0; }
sup { line-height: 0.1em; }
`;

  const after = `
html {
  color: ${text} !important;
  /* The paginator paints the page colour behind the pages from these, over
     whatever background a chapter sets for itself. */
  --theme-bg-color: ${background};
  --override-color: true;
}
/* Not forced: the paginator reads the page colour here, paints it behind the
   pages itself and clears it, so the footer shows through. */
body {
  background-color: ${background};
  color: ${text} !important;
}
html {
  font-size: ${px(prefs.fontSize)} !important;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
}
/* The font isn't forced on body, so custom CSS can set it there, as before;
   coming after the chapter's own styles, it still wins over theirs. */
body {
  margin: 0 !important;
  padding: 0 !important;
  ${family ? `font-family: ${family};` : ''}
  line-height: ${prefs.lineHeight} !important;
  text-align: ${textAlign};
  overflow-wrap: break-word;
}
body :is(${textBlocks}) {
  ${family ? 'font-family: inherit !important;' : ''}
  font-size: inherit;
  line-height: inherit !important;
  color: inherit !important;
  background-color: transparent !important;
}
body :is(p, li, dd, blockquote) { text-align: ${textAlign} !important; }
body p {
  margin: 0 0 ${em(prefs.paragraphSpacing)} 0 !important;
  text-indent: ${em(prefs.textIndent)} !important;
}
body :is(h1, h2, h3, h4, h5, h6) {
  ${family ? 'font-family: inherit !important;' : ''}
  color: inherit !important;
  line-height: 1.3 !important;
  text-indent: 0 !important;
}
body :is(h1, h2, h3, h4, h5, h6) + p { text-indent: 0 !important; }
body a { color: ${primary} !important; }
body :is(pre, code, kbd, samp) { font-family: monospace !important; }
.ln-chapter-title {
  font-size: 1.35em !important;
  font-weight: bold;
  text-align: center !important;
  margin: 0.5em 0 1.5em !important;
}
.ln-bionic { font-weight: bold; }
.ln-chapter-end { margin: 2em 0 1em; text-align: center; }
.ln-chapter-end p { margin: 16px 0 !important; text-align: center !important; }
.ln-spread-fill { display: none !important; }
.ln-spread-fill.ln-filled {
  display: block !important; break-before: column; height: 1px;
}
.ln-next-chapter {
  display: block; box-sizing: border-box; width: 100%; min-height: 40px;
  padding: 0 16px; border-radius: 50px; line-height: 40px; font-size: 16px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  text-decoration: none; background: ${primary};
  color: ${background} !important;
}
::selection { background: ${secondary}; color: ${onSecondary}; }
::highlight(${HIGHLIGHTS.search}) {
  background-color: rgba(255, 213, 79, 0.45);
  color: inherit;
}
::highlight(${HIGHLIGHTS.searchCurrent}) {
  background-color: rgba(255, 152, 0, 0.75);
  color: #000;
}
::highlight(${HIGHLIGHTS.tts}) {
  background-color: color-mix(in srgb, ${primary} 35%, transparent);
}
::highlight(${HIGHLIGHTS.ttsTarget}) {
  background-color: color-mix(in srgb, ${primary} 18%, transparent);
}
${
  prefs.flow === 'scrolled'
    ? `body { padding: ${px(SCROLLED_PADDING.top)} 0 ${px(
        SCROLLED_PADDING.bottom,
      )} !important; }`
    : ''
}
${
  prefs.flow === 'paginated' || prefs.continuousChapters
    ? '.ln-chapter-end { display: none !important; }'
    : ''
}
${
  prefs.removeExtraParagraphSpacing
    ? 'br + br, p:empty, div:empty { display: none !important; }'
    : ''
}
${customCss}
`;

  return { before, after };
};
