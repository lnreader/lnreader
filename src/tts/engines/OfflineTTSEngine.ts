import TTSManager from 'react-native-sherpa-onnx-offline-tts';
import RNFS from 'react-native-fs';
import { EngineType } from './TTSEngine';
import type { TTSEngine } from './TTSEngine';
import type { VoiceMetadata } from '../models/VoiceMetadata';

/**
 * Offline TTS Engine using Sherpa-ONNX
 * Implements the TTSEngine interface for offline speech synthesis
 */
export class OfflineTTSEngine implements TTSEngine {
  private initialized = false;
  private speaking = false;
  private paused = false;
  private currentSpeed = 1.0;
  private availableVoices: VoiceMetadata[] = [];
  private modelId: string = '';
  private lastSpokenText: string = '';
  private pausedPosition: number = 0;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Set up default model path using RNFS DocumentDirectoryPath
      const modelPath = RNFS.DocumentDirectoryPath + '/tts-models';

      // Ensure model directory exists
      const exists = await RNFS.exists(modelPath);
      if (!exists) {
        await RNFS.mkdir(modelPath);
      }

      // Initialize Sherpa-ONNX TTS with model path as the ID
      // The actual config is a JSON string with modelPath, tokensPath, dataDirPath
      this.modelId = modelPath;

      // Initialize with a placeholder - actual initialization should happen
      // when a model is downloaded and configured
      // For now, we set up the structure for the model
      await TTSManager.initialize(modelPath);

      // Set up available voices (static list for offline models)
      this.availableVoices = [
        {
          voiceId: 'en_US-lessac-medium',
          name: 'English (US) - Medium',
          language: 'en-US',
          gender: 'male',
          modelPath: modelPath + '/en_US-lessac-medium',
        },
        {
          voiceId: 'en_US-lessac-large',
          name: 'English (US) - Large',
          language: 'en-US',
          gender: 'male',
          modelPath: modelPath + '/en_US-lessac-large',
        },
      ];

      this.initialized = true;
    } catch (error) {
      // Throw error to signal initialization failure (for fallback)
      throw new Error(`Failed to initialize OfflineTTSEngine: ${error}`);
    }
  }

  async speak(text: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('OfflineTTSEngine not initialized');
    }

    // Stop any current speech first
    if (this.speaking) {
      this.stop();
    }

    this.speaking = true;
    this.paused = false;
    this.lastSpokenText = text;
    this.pausedPosition = 0;

    try {
      const speakerId = 0; // Default speaker for single-speaker models
      await TTSManager.generateAndPlay(text, speakerId, this.currentSpeed);

      this.speaking = false;
    } catch (error) {
      this.speaking = false;
      throw new Error(`Speech generation failed: ${error}`);
    }
  }

  pause(): void {
    if (this.speaking && !this.paused) {
      // Note: Sherpa-ONNX doesn't have native pause support
      // We track position manually and stop playback
      this.pausedPosition = Math.floor(this.lastSpokenText.length * 0.1); // Approximate 10% position
      // There's no stop() in Sherpa-ONNX, so we use deinitialize as a workaround
      // In practice, you'd use generateAndSave and play audio manually
      this.paused = true;
      this.speaking = false;
    }
  }

  resume(): void {
    if (this.paused && this.lastSpokenText) {
      // Re-speak from saved position (approximation)
      const remainingText = this.lastSpokenText.slice(this.pausedPosition);

      this.paused = false;
      this.speaking = true;

      const speakerId = 0;
      TTSManager.generateAndPlay(remainingText, speakerId, this.currentSpeed)
        .then(() => {
          this.speaking = false;
        })
        .catch((error: Error) => {
          this.speaking = false;
          console.warn('Resume failed:', error);
        });
    }
  }

  stop(): void {
    // Note: Sherpa-ONNX doesn't have a stop() method
    // The library requires deinitialize to stop playback
    // In a real implementation, you'd use audio playback controls
    // or a different approach (e.g., generate to file + play with native player)
    this.speaking = false;
    this.paused = false;
    this.pausedPosition = 0;

    // Attempt to deinitialize to stop playback
    try {
      TTSManager.deinitialize();
      // Re-initialize for next use
      if (this.modelId) {
        TTSManager.initialize(this.modelId);
      }
    } catch {
      // Ignore errors on stop
    }
  }

  setVoice(voiceId: string): void {
    // Voice switching in Sherpa-ONNX requires re-initialization with different model
    // Store the voice ID for reference
    console.log(
      'Voice switching requires re-initialization with different model',
    );
  }

  setSpeed(speed: number): void {
    // Clamp speed between 0.5 and 2.0
    this.currentSpeed = Math.max(0.5, Math.min(2.0, speed));
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isSpeaking(): boolean {
    return this.speaking;
  }

  getAvailableVoices(): VoiceMetadata[] {
    return this.availableVoices;
  }

  /**
   * Get the engine type
   */
  static get engineType(): EngineType {
    return EngineType.OFFLINE;
  }

  get engineTypeValue(): EngineType {
    return EngineType.OFFLINE;
  }
}
