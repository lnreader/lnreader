/**
 * A text-to-speech engine installed on the device.
 *
 * Android only: iOS has no concept of swappable synthesis engines, so
 * {@linkcode TtsFactory.getEngines} always resolves to an empty array there.
 *
 * @see {@linkcode TtsFactory.getEngines}
 */
export interface TtsEngine {
  /** Platform engine identifier (the Android package name). */
  name: string;
  /** Human-readable label shown in the picker. */
  label: string;
}
