/**
 * A voice offered by a text-to-speech engine.
 *
 * @see {@linkcode TtsFactory.getVoices}
 */
export interface TtsVoice {
  /** Platform voice identifier, passed back via {@linkcode TtsSettings.voiceIdentifier}. */
  identifier: string;
  /** Human-readable voice name. */
  name: string;
  /** BCP-47 language tag, when known. */
  language?: string;
}
