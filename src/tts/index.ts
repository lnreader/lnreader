import type { TTSEngine, EngineType } from './engines/TTSEngine';
import { NativeTTSEngine } from './engines/NativeTTSEngine';
import { OfflineTTSEngine } from './engines/OfflineTTSEngine';
import type { VoiceMetadata } from './models/VoiceMetadata';
import {
  ModelManager,
  type DownloadProgressCallback,
} from './manager/ModelManager';
import { VoiceManager } from './manager/VoiceManager';
import { PlayerController, type PlayerStatus } from './PlayerController';

// TTS Engine interface and types
export { EngineType };
export type { TTSEngine };

// Engine implementations
export { NativeTTSEngine };
export { OfflineTTSEngine };

// Voice models
export type { VoiceMetadata };

// Managers
export { ModelManager };
export type { DownloadProgressCallback };
export { VoiceManager };

// Player controller
export { PlayerController };
export type { PlayerStatus };

// Singleton instance
let ttsPlayerInstance: PlayerController | null = null;

/**
 * Get the singleton TTS player instance
 * Creates the instance if it doesn't exist
 * @returns PlayerController singleton
 */
export function getTTSPlayer(): PlayerController {
  if (!ttsPlayerInstance) {
    const modelManager = new ModelManager();
    const voiceManager = new VoiceManager(modelManager);
    ttsPlayerInstance = new PlayerController(modelManager, voiceManager);
  }
  return ttsPlayerInstance;
}

/**
 * Initialize the TTS player
 * Must be called before using TTS features
 * @returns Promise that resolves when initialized
 */
export async function initializeTTS(): Promise<PlayerController> {
  const player = getTTSPlayer();
  await player.initialize();
  return player;
}

/**
 * Reset the TTS player instance
 * Useful for testing or when needing to reinitialize
 */
export function resetTTSPlayer(): void {
  if (ttsPlayerInstance) {
    ttsPlayerInstance.stop();
  }
  ttsPlayerInstance = null;
}
