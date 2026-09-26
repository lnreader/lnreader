import type { ChapterReaderSettings } from '@hooks/persisted/useSettings';

/**
 * Floating TTS controller position, stored as fractions of the viewport so a
 * relocated button survives chapter reloads and orientation changes. The
 * in-page controller is rebuilt from scratch for every chapter (the WebView
 * source is regenerated per chapter), so without persistence the button always
 * falls back to its CSS default (`top: 50%; left: 20px`).
 */
export interface TtsControllerPosition {
  /** Fraction of the viewport width, in the closed interval [0, 1]. */
  x: number;
  /** Fraction of the viewport height, in the closed interval [0, 1]. */
  y: number;
}

/** `reader.post` message type the page sends after the button is relocated. */
export const TTS_CONTROLLER_POSITION_MESSAGE = 'tts-position';

/**
 * Coerce a posted value into a storable position. Out-of-range numbers are
 * clamped into [0, 1] and rounded so storage stays tidy; anything that is not
 * a pair of finite numbers (missing, NaN, Infinity, wrong type) is rejected
 * so a corrupt payload can never pin the button off-screen.
 */
export const normalizeTtsControllerPosition = (
  value: unknown,
): TtsControllerPosition | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { x, y } = value as Record<string, unknown>;
  if (typeof x !== 'number' || !Number.isFinite(x)) {
    return undefined;
  }
  if (typeof y !== 'number' || !Number.isFinite(y)) {
    return undefined;
  }
  const round = (n: number) => Math.round(n * 10000) / 10000;
  return {
    x: round(Math.min(1, Math.max(0, x))),
    y: round(Math.min(1, Math.max(0, y))),
  };
};

/**
 * Return reader settings with the controller position merged into `tts`,
 * preserving every other TTS field (engine, voice, rate, ...).
 */
export const withTtsControllerPosition = (
  settings: ChapterReaderSettings | undefined,
  position: TtsControllerPosition,
): ChapterReaderSettings =>
  ({
    ...settings,
    tts: {
      ...settings?.tts,
      controllerPosition: position,
    },
  } as ChapterReaderSettings);
