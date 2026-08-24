import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { TTS_CONTROLLER_POSITION } from '@hooks/persisted/useSettings';

/**
 * Saved floating TTS controller position (#2000). Absolute px as produced by
 * assets/reader/js/index.js, already clamped to the viewport.
 */
export type TtsControllerPosition = { left: number; top: number };

/**
 * Shape validation for the tts-controller-position message payload. Accepts
 * only an object whose left and top are finite numbers; anything else -> null.
 * The JS side already clamps to >=8px, so this is shape validation only.
 */
export const parseTtsControllerPosition = (
  data: unknown,
): TtsControllerPosition | null => {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const { left, top } = data as { left?: unknown; top?: unknown };
  if (
    typeof left !== 'number' ||
    !Number.isFinite(left) ||
    typeof top !== 'number' ||
    !Number.isFinite(top)
  ) {
    return null;
  }
  return { left, top };
};

/**
 * Read the saved position; null when absent (never undefined). The try/catch
 * guards against corrupt stored data: getMMKVObject JSON.parse throws on a
 * malformed value, and a cosmetic position read must never break the reader's
 * per-chapter build.
 */
export const getSavedTtsControllerPosition =
  (): TtsControllerPosition | null => {
    try {
      return (
        getMMKVObject<TtsControllerPosition>(TTS_CONTROLLER_POSITION) ?? null
      );
    } catch {
      return null;
    }
  };

/**
 * Persist a controller position. Called from the WebView onMessage handler on
 * drag release; one call per gesture.
 */
export const saveTtsControllerPosition = (
  position: TtsControllerPosition,
): void => {
  setMMKVObject(TTS_CONTROLLER_POSITION, position);
};
