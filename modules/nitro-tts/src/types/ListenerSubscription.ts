/**
 * Removes a listener registered on a native TTS session.
 *
 * @see {@linkcode ListenerSubscription.remove}
 */
export interface ListenerSubscription {
  /** Stops future listener emissions. */
  remove: () => void;
}
