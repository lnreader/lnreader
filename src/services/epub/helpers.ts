/**
 * Pure helpers extracted from import.ts (spec-1997 R1) — no behavior
 * change, directly unit-testable. import.ts delegates to these.
 */

/**
 * URI-decode an epub-internal path with graceful passthrough: malformed
 * % sequences are returned unchanged instead of throwing.
 */
export const decodePath = (path: string): string => {
  try {
    return decodeURI(path);
  } catch {
    return path;
  }
};

/**
 * Chapter name fallback: last path segment across both separator styles,
 * 'unknown' when the segment is empty (e.g. trailing separator).
 */
export const chapterNameFallback = (path: string): string =>
  path.split(/[/\\]/).pop() || 'unknown';
