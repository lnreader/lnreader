import type { VoiceMetadata } from '../models/VoiceMetadata';

/**
 * TTS Engine types
 */
export enum EngineType {
  /** Native iOS/Android speech synthesis */
  NATIVE = 'native',
  /** Offline TTS using local models (Piper/Sherpa-ONNX) */
  OFFLINE = 'offline',
}

/**
 * Abstract TTS Engine interface using Strategy Pattern
 * Both NativeTTSEngine and OfflineTTSEngine implement this interface
 */
export interface TTSEngine {
  /**
   * Initialize the TTS engine
   * Must be called before any other operations
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Speak the given text
   * @param text - Text to speak
   * @throws Error if not initialized or speak fails
   */
  speak(text: string): Promise<void>;

  /**
   * Pause current speech
   */
  pause(): void;

  /**
   * Resume paused speech
   */
  resume(): void;

  /**
   * Stop current speech immediately
   */
  stop(): void;

  /**
   * Set the voice to use
   * @param voiceId - Voice identifier from getAvailableVoices()
   */
  setVoice(voiceId: string): void;

  /**
   * Set speech rate
   * @param speed - Speed factor (0.5 = half speed, 1.0 = normal, 2.0 = double)
   */
  setSpeed(speed: number): void;

  /**
   * Check if engine is initialized
   */
  isInitialized(): boolean;

  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean;

  /**
   * Get list of available voices
   * @returns Array of voice metadata
   */
  getAvailableVoices(): VoiceMetadata[];
}
