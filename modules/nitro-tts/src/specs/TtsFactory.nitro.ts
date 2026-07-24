import type { HybridObject } from 'react-native-nitro-modules';
import type { TtsEngine } from '../types/TtsEngine';
import type { TtsVoice } from '../types/TtsVoice';
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

  /**
   * Lists text-to-speech engines installed on the device.
   *
   * Android only: resolves to an empty array on iOS.
   */
  getEngines(): Promise<TtsEngine[]>;

  /**
   * Lists voices offered by `engineName`, or by the system default engine
   * when omitted. iOS ignores `engineName` and lists system voices.
   */
  getVoices(engineName?: string): Promise<TtsVoice[]>;
}
