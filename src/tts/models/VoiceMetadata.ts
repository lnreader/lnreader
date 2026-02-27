/**
 * Voice metadata for TTS engines
 */
export interface VoiceMetadata {
  /** Unique identifier for the voice */
  voiceId: string;
  /** Human-readable voice name */
  name: string;
  /** Language code (e.g., 'en-US', 'zh-CN') */
  language: string;
  /** Gender of the voice */
  gender: 'male' | 'female' | 'neutral';
  /** Optional: path to model file for offline engines */
  modelPath?: string;
}
