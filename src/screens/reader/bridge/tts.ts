/**
 * TTS bridge — typed, per-command script builders for the reader WebView's
 * window.tts surface.
 *
 * Every function returns an injectJavaScript-ready script. Method names are
 * fixed literals (no string-built interpolation — the #2009 hazard class),
 * and numeric arguments are sanitized so the emitted text always parses.
 * The scripts mirror the exact Windows/chrome surface core.js exposes:
 * setPlaybackState, setActiveIndex, complete, start (pinned by the
 * core-surface parity test).
 */

import type { TtsPlaybackState } from '@modules/nitro-tts';

/** Coerce a control value to a finite, rounded integer (0 when absent). */
const sanitizeNumber = (value: number): number =>
  Number.isFinite(value) ? Math.round(value) : 0;

/** Notify the WebView TTS controls of a playback state change. */
export const ttsSetPlaybackStateScript = (state: TtsPlaybackState): string =>
  `window.tts?.setPlaybackState?.(${JSON.stringify(state)}); true;`;

/** Signal the WebView that TTS finished the chapter (auto-advance path). */
export const ttsCompleteScript = (): string =>
  'window.tts?.complete?.(); true;';

/** Highlight the currently-spoken element in the WebView. */
export const ttsSetActiveIndexScript = (index: number): string =>
  `window.tts?.setActiveIndex?.(${sanitizeNumber(index)}); true;`;

/**
 * Auto-start TTS after the page has loaded, when the reader settings have TTS
 * enabled. Kept as a guarded IIFE: it must no-op on any device where the
 * WebView worklet or settings are momentarily unavailable, never throw.
 */
export const ttsAutoStartScript = (): string => `(function() {
  if (window.tts && reader.generalSettings.val.TTSEnable) {
    setTimeout(() => {
      tts.start();
    }, 500);
  }
})();`;
