/**
 * PageReader bridge — typed script builders for the reader WebView's
 * window.pageReader surface.
 *
 * Every function returns an injectJavaScript-ready script. Method names are
 * fixed literals (no string-built interpolation — the #2009 hazard class),
 * and numeric arguments are sanitized so the emitted text always parses.
 * The scripts mirror the exact Windows/chrome surface core.js exposes:
 * movePage (pinned by the core-surface parity test).
 */

/** Coerce a page number to a finite, rounded integer (0 when absent). */
const sanitizeNumber = (value: number): number =>
  Number.isFinite(value) ? Math.round(value) : 0;

/** Jump the page-reader viewport to the given page (0 = first page). */
export const pageReaderMovePageScript = (page: number): string =>
  `window.pageReader?.movePage(${sanitizeNumber(page)}); true;`;
