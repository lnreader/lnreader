/**
 * One independently navigable paragraph in a TTS queue.
 *
 * @see {@linkcode TtsSession.load}
 */
export interface TtsParagraph {
  /** Stable key used to synchronize native progress with the WebView DOM. */
  id: string;
  /** Text sent to the selected native speech voice. */
  text: string;
}
