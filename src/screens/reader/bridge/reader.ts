/**
 * Reader-state bridge — typed, per-command script builders for the reader
 * WebView's window.reader surface (settings, battery, adjacent chapters).
 *
 * Every function returns an injectJavaScript-ready script; method names are
 * fixed literals and settings payloads are JSON-serialized, so the #2009
 * hazard class (string-built method interpolation) cannot occur here.
 * The script bodies mirror exactly what WebViewReader emitted before this
 * module existed — including the two battery forms: the unguarded one used
 * on the device battery listener and the guarded one used at load time,
 * where the page may not have booted window.reader yet.
 */

import type { ChapterInfo } from '@database/types';
import type {
  ChapterGeneralSettings,
  ChapterReaderSettings,
} from '@hooks/persisted/useSettings';

/** Replace the live reader-settings state inside the WebView. */
export const readerSetSettingsScript = (
  settings: ChapterReaderSettings,
): string => `reader.readerSettings.val = ${JSON.stringify(settings)}`;

/** Replace the live general-settings state inside the WebView. */
export const readerSetGeneralSettingsScript = (
  settings: ChapterGeneralSettings,
): string => `reader.generalSettings.val = ${JSON.stringify(settings)}`;

/** Push a raw battery level (native-controlled number, 0-100). */
export const readerSetBatteryLevelScript = (level: number): string =>
  `reader.batteryLevel.val = ${level}`;

/**
 * Push a battery level guarded on the page being booted. Used at load time:
 * the page sets up window.reader while bootstrapping, and an early update
 * must be dropped rather than throw.
 */
export const readerSetBatteryLevelGuardedScript = (level: number): string =>
  `if (window.reader?.batteryLevel) {
    window.reader.batteryLevel.val = ${level};
  }`;

/** ADJACENT_CHAPTERS strings the WebView needs for the next/prev buttons. */
export type AdjacentChapterStrings = {
  nextChapter: string;
};

/**
 * Push the resolved neighbouring chapters into the loaded page. The chapter
 * is rendered before its neighbours are known, so this always runs as an
 * injection (never baked into the HTML — rebaking would reload the WebView
 * and lose the reading position).
 */
export const readerSetAdjacentChaptersScript = (
  nextChapter: ChapterInfo | undefined,
  prevChapter: ChapterInfo | undefined,
  strings: AdjacentChapterStrings,
): string => `window.reader?.setAdjacentChapters?.(${JSON.stringify({
  nextChapter,
  prevChapter,
  strings,
})});
  true;
`;
