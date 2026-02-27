import * as Speech from 'expo-speech';
import { EngineType } from './TTSEngine';
import type { TTSEngine } from './TTSEngine';
import type { VoiceMetadata } from '../models/VoiceMetadata';

/**
 * Native iOS TTS Engine using expo-speech
 * Implements the TTSEngine interface for native speech synthesis
 */
export class NativeTTSEngine implements TTSEngine {
  private initialized = false;
  private speaking = false;
  private paused = false;
  private currentVoiceId: string | null = null;
  private currentSpeed = 1.0;
  private availableVoices: VoiceMetadata[] = [];
  private isSpeakingResolve: (() => void) | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Load available voices from the device
      const voices = await Speech.getAvailableVoicesAsync();

      this.availableVoices = voices.map(voice => ({
        voiceId: voice.name, // Use name as the unique identifier
        name: voice.name,
        language: voice.language || 'en-US',
        gender: this.inferGender(voice.name),
      }));

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize NativeTTSEngine: ${error}`);
    }
  }

  private inferGender(name: string): 'male' | 'female' | 'neutral' {
    const lowerName = name.toLowerCase();
    if (
      lowerName.includes('female') ||
      lowerName.includes('woman') ||
      lowerName.includes('girl')
    ) {
      return 'female';
    }
    if (
      lowerName.includes('male') ||
      lowerName.includes('man') ||
      lowerName.includes('boy')
    ) {
      return 'male';
    }
    return 'neutral';
  }

  async speak(text: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('NativeTTSEngine not initialized');
    }

    // Stop any current speech first
    if (this.speaking) {
      await this.stop();
    }

    return new Promise((resolve, reject) => {
      this.isSpeakingResolve = resolve;
      this.speaking = true;
      this.paused = false;

      const options: Speech.SpeechOptions = {
        pitch: 1.0,
        rate: this.currentSpeed,
        ...(this.currentVoiceId ? { voiceId: this.currentVoiceId } : {}),
        onDone: () => {
          this.speaking = false;
          this.paused = false;
          if (this.isSpeakingResolve) {
            this.isSpeakingResolve();
            this.isSpeakingResolve = null;
          }
          resolve();
        },
        onError: error => {
          this.speaking = false;
          this.paused = false;
          if (this.isSpeakingResolve) {
            this.isSpeakingResolve();
            this.isSpeakingResolve = null;
          }
          reject(new Error(`Speech error: ${error}`));
        },
      };

      Speech.speak(text, options);
    });
  }

  pause(): void {
    if (this.speaking && !this.paused) {
      Speech.pause();
      this.paused = true;
    }
  }

  resume(): void {
    if (this.paused) {
      Speech.resume();
      this.paused = false;
    }
  }

  stop(): void {
    Speech.stop();
    this.speaking = false;
    this.paused = false;
    if (this.isSpeakingResolve) {
      this.isSpeakingResolve();
      this.isSpeakingResolve = null;
    }
  }

  setVoice(voiceId: string): void {
    this.currentVoiceId = voiceId;
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
    return EngineType.NATIVE;
  }

  get engineTypeValue(): EngineType {
    return EngineType.NATIVE;
  }
}
