/**
 * Search bridge — typed script builders for the reader WebView's
 * window.readerSearch surface.
 *
 * Every emission names its target method literally: script strings never
 * carry a computed method name (the PR #2009 hazard class). Used by
 * WebViewReader (onLoadEnd replay) and useChapter (search-text emission and
 * NEXT/PREV navigation).
 */

/** Run a search against the page for the given query. */
export const readerSearchScript = (query: string): string =>
  `window.readerSearch?.search(${JSON.stringify(query)}); true;`;

export type SearchDirection = 'NEXT' | 'PREV';

/** Jump to the next or previous occurrence of the given query. */
export const readerSearchNavigateScript = (
  direction: SearchDirection,
  text: string,
): string =>
  direction === 'NEXT'
    ? `window.readerSearch?.next(${JSON.stringify(text)}); true;`
    : `window.readerSearch?.previous(${JSON.stringify(text)}); true;`;
