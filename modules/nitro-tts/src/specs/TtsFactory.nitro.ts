import type { HybridObject } from 'react-native-nitro-modules';
import type { TtsSession } from './TtsSession.nitro';

/**
 * Creates ready native text-to-speech playback sessions.
 *
 * @see {@linkcode TtsFactory.createSession}
 */
export interface TtsFactory
  extends HybridObject<{ ios: 'swift'; android: 'kotlin' }> {
  /**
   * Creates or reconnects to the app-owned playback session.
   */
  createSession(): Promise<TtsSession>;
}
