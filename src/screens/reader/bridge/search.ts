/**
 * Search bridge — typed script builders for the reader WebView's
 * window.readerSearch surface.
 *
 * Note: only the search-text emission from WebViewReader (onLoadEnd replay)
 * is routed through this module in this change. The chapter-search
 * navigation emitted from useChapter.ts still uses string-built method
 * interpolation (`window.readerSearch?.${method}(...)` — PR #2009 hazard
 * class) and is tracked as a follow-up.
 */

/** Run a search against the page for the given query. */
export const readerSearchScript = (query: string): string =>
  `window.readerSearch?.search(${JSON.stringify(query)}); true;`;
