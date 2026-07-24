/**
 * Current lifecycle state of a native TTS session.
 *
 * @see {@linkcode TtsSession.addOnStateChangedListener}
 */
export type TtsPlaybackState =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'completed'
  | 'error';
