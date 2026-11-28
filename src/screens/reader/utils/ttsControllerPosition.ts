import type { ChapterReaderSettings } from '@hooks/persisted/useSettings';

/**
 * Floating TTS controller position: its left and top as fractions of the
 * viewport, so a relocated button is restored at the same spot whatever its
 * size, in a newly loaded reader page and after orientation changes. Without a
 * saved position the CSS default applies (`top: 50%; left: 20px`).
 */
export interface TtsControllerPosition {
  /** Fraction of the viewport width, in the closed interval [0, 1]. */
  x: number;
  /** Fraction of the viewport height, in the closed interval [0, 1]. */
  y: number;
}

/** `reader.post` message type the page sends after the button is relocated. */
export const TTS_CONTROLLER_POSITION_MESSAGE = 'tts-position';

const isViewportFraction = (n: unknown): n is number =>
  typeof n === 'number' && n >= 0 && n <= 1;

/**
 * Validate a posted value as a storable position. Anything that is not a pair
 * of numbers within [0, 1] is rejected so a corrupt payload can never pin the
 * button off-screen.
 */
export const normalizeTtsControllerPosition = (
  value: unknown,
): TtsControllerPosition | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { x, y } = value as Record<string, unknown>;
  if (!isViewportFraction(x) || !isViewportFraction(y)) {
    return undefined;
  }
  return { x, y };
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
