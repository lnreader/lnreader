import type { TTSEngine, EngineType } from './engines/TTSEngine';
import { EngineType as EngineTypeEnum } from './engines/TTSEngine';
import { NativeTTSEngine } from './engines/NativeTTSEngine';
import { OfflineTTSEngine } from './engines/OfflineTTSEngine';
import type { ModelManager } from './manager/ModelManager';
import type { VoiceManager } from './manager/VoiceManager';
import type { VoiceMetadata } from './models/VoiceMetadata';

/**
 * Player status information
 */
export interface PlayerStatus {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Whether playback is paused */
  isPaused: boolean;
  /** Current engine type */
  currentEngine: EngineType;
  /** Current speed factor */
  currentSpeed: number;
  /** Current voice ID */
  currentVoiceId: string | null;
  /** Whether the player is initialized */
  isInitialized: boolean;
}

/**
 * Default voice ID to use when none selected
 */
const DEFAULT_VOICE_ID = 'en_US-ryan-medium';

/**
 * Default playback speed
 */
const DEFAULT_SPEED = 1.0;

/**
 * Player Controller for unified TTS playback
 * Provides a single API for playing, pausing, stopping, and controlling TTS
 * across both native and offline TTS engines
 */
export class PlayerController {
  private modelManager: ModelManager;
  private voiceManager: VoiceManager;
  private currentEngine: TTSEngine | null = null;
  private nativeEngine: NativeTTSEngine;
  private offlineEngine: OfflineTTSEngine;
  private currentEngineType: EngineType = EngineTypeEnum.NATIVE;
  private currentSpeed: number = DEFAULT_SPEED;
  private initialized = false;
  private autoFallback = true;

  /**
   * Create a new PlayerController
   * @param modelManager - ModelManager instance
   * @param voiceManager - VoiceManager instance
   */
  constructor(modelManager: ModelManager, voiceManager: VoiceManager) {
    this.modelManager = modelManager;
    this.voiceManager = voiceManager;
    this.nativeEngine = new NativeTTSEngine();
    this.offlineEngine = new OfflineTTSEngine();
  }

  /**
   * Initialize the player controller
   * Sets up the TTS engine and loads preferences
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize managers
    await this.modelManager.initialize();
    await this.voiceManager.initialize();

    // Try to initialize with offline engine first (preferred)
    try {
      await this.offlineEngine.initialize();
      this.currentEngine = this.offlineEngine;
      this.currentEngineType = EngineTypeEnum.OFFLINE;
    } catch (error) {
      console.warn(
        'Offline TTS initialization failed, falling back to native:',
        error,
      );

      // Fall back to native TTS
      try {
        await this.nativeEngine.initialize();
        this.currentEngine = this.nativeEngine;
        this.currentEngineType = EngineTypeEnum.NATIVE;
      } catch (nativeError) {
        throw new Error(
          `Both TTS engines failed to initialize: offline=${error}, native=${nativeError}`,
        );
      }
    }

    // Load saved preferences
    await this.loadPreferences();

    this.initialized = true;
  }

  /**
   * Load saved preferences (voice, speed)
   */
  private async loadPreferences(): Promise<void> {
    // Load selected voice
    const selectedVoice = await this.voiceManager.getSelectedVoice();
    if (selectedVoice) {
      this.setVoice(selectedVoice.voiceId);
    } else {
      // Set default voice
      this.setVoice(DEFAULT_VOICE_ID);
    }
  }

  /**
   * Set the TTS engine to use
   * @param engineType - The engine type to use
   */
  async setEngine(engineType: EngineType): Promise<void> {
    if (!this.initialized) {
      throw new Error('PlayerController not initialized');
    }

    if (engineType === this.currentEngineType) {
      return;
    }

    // Stop any current playback
    this.stop();

    // Initialize the new engine if needed
    if (engineType === EngineTypeEnum.OFFLINE) {
      try {
        await this.offlineEngine.initialize();
        this.currentEngine = this.offlineEngine;
        this.currentEngineType = EngineTypeEnum.OFFLINE;
      } catch (error) {
        if (this.autoFallback) {
          console.warn('Failed to switch to offline engine:', error);
          // Fall back to native
          await this.setEngine(EngineTypeEnum.NATIVE);
        } else {
          throw error;
        }
      }
    } else {
      try {
        await this.nativeEngine.initialize();
        this.currentEngine = this.nativeEngine;
        this.currentEngineType = EngineTypeEnum.NATIVE;
      } catch (error) {
        throw new Error(`Failed to initialize native engine: ${error}`);
      }
    }

    // Re-apply voice and speed settings
    if (this.voiceManager.getSelectedVoiceId()) {
      this.setVoice(this.voiceManager.getSelectedVoiceId()!);
    }
    this.setSpeed(this.currentSpeed);
  }

  /**
   * Get the current engine type
   */
  getEngineType(): EngineType {
    return this.currentEngineType;
  }

  /**
   * Speak the given text
   * @param text - Text to speak
   */
  async play(text: string): Promise<void> {
    if (!this.initialized || !this.currentEngine) {
      throw new Error('PlayerController not initialized');
    }

    // Ensure engine is initialized
    if (!this.currentEngine.isInitialized()) {
      await this.currentEngine.initialize();
    }

    await this.currentEngine.speak(text);
  }

  /**
   * Pause current playback
   */
  pause(): void {
    if (this.currentEngine && this.currentEngine.isSpeaking()) {
      this.currentEngine.pause();
    }
  }

  /**
   * Resume paused playback
   */
  resume(): void {
    if (this.currentEngine) {
      this.currentEngine.resume();
    }
  }

  /**
   * Stop current playback
   */
  stop(): void {
    if (this.currentEngine) {
      this.currentEngine.stop();
    }
  }

  /**
   * Set playback speed
   * @param speed - Speed factor (0.5 = half speed, 1.0 = normal, 2.0 = double)
   */
  setSpeed(speed: number): void {
    // Clamp speed between 0.5 and 2.0
    this.currentSpeed = Math.max(0.5, Math.min(2.0, speed));

    if (this.currentEngine) {
      this.currentEngine.setSpeed(this.currentSpeed);
    }
  }

  /**
   * Get current playback speed
   */
  getSpeed(): number {
    return this.currentSpeed;
  }

  /**
   * Set the voice to use
   * @param voiceId - Voice identifier
   */
  setVoice(voiceId: string): void {
    if (this.currentEngine) {
      this.currentEngine.setVoice(voiceId);
    }

    // Save to storage
    this.voiceManager.selectVoice(voiceId).catch(error => {
      console.error('Failed to save voice preference:', error);
    });
  }

  /**
   * Get the current voice
   */
  async getCurrentVoice(): Promise<VoiceMetadata | null> {
    return this.voiceManager.getSelectedVoice();
  }

  /**
   * Download a voice model
   * @param voiceId - Voice identifier to download
   * @param onProgress - Optional progress callback
   */
  async downloadVoice(
    voiceId: string,
    onProgress?: (progress: {
      loaded: number;
      total: number;
      percentage: number;
    }) => void,
  ): Promise<void> {
    await this.modelManager.downloadModel(voiceId, onProgress);
  }

  /**
   * Check if a voice is downloaded
   * @param voiceId - Voice identifier
   */
  async isVoiceDownloaded(voiceId: string): Promise<boolean> {
    return this.modelManager.isModelDownloaded(voiceId);
  }

  /**
   * Get list of downloaded voices
   */
  async getDownloadedVoices(): Promise<VoiceMetadata[]> {
    return this.voiceManager.getDownloadedVoices();
  }

  /**
   * Get list of all available voices
   */
  getAvailableVoices(): VoiceMetadata[] {
    return this.voiceManager.getAvailableVoices();
  }

  /**
   * Get current player status
   */
  getStatus(): PlayerStatus {
    return {
      isPlaying: this.currentEngine?.isSpeaking() ?? false,
      isPaused: false, // Track this separately if needed
      currentEngine: this.currentEngineType,
      currentSpeed: this.currentSpeed,
      currentVoiceId: this.voiceManager.getSelectedVoiceId(),
      isInitialized: this.initialized,
    };
  }

  /**
   * Check if player is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Enable or disable automatic fallback to native TTS
   * @param enabled - Whether to enable auto-fallback
   */
  setAutoFallback(enabled: boolean): void {
    this.autoFallback = enabled;
  }

  /**
   * Get the model manager instance
   */
  getModelManager(): ModelManager {
    return this.modelManager;
  }

  /**
   * Get the voice manager instance
   */
  getVoiceManager(): VoiceManager {
    return this.voiceManager;
  }
}
