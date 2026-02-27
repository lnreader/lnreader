import AsyncStorage from '@react-native-async-storage/async-storage';
import type { VoiceMetadata } from '../models/VoiceMetadata';
import type { ModelManager } from './ModelManager';

/**
 * Storage key for selected voice
 */
const STORAGE_KEY_SELECTED_VOICE = 'tts_selected_voice';

/**
 * Piper voice configuration
 * Hardcoded list of popular Piper voices
 */
interface PiperVoice {
  voiceId: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  quality: 'low' | 'medium' | 'high';
  dataset: string;
}

/**
 * List of available Piper voices
 * Sourced from rhasspy/piper-voices
 */
const PIPER_VOICES: PiperVoice[] = [
  // English US voices
  {
    voiceId: 'en_US-ryan-medium',
    name: 'Ryan (Medium)',
    language: 'en-US',
    gender: 'male',
    quality: 'medium',
    dataset: 'ryan',
  },
  {
    voiceId: 'en_US-ryan-low',
    name: 'Ryan (Low)',
    language: 'en-US',
    gender: 'male',
    quality: 'low',
    dataset: 'ryan',
  },
  {
    voiceId: 'en_US-lessac-medium',
    name: 'Lessac (Medium)',
    language: 'en-US',
    gender: 'male',
    quality: 'medium',
    dataset: 'lessac',
  },
  {
    voiceId: 'en_US-lessac-high',
    name: 'Lessac (High)',
    language: 'en-US',
    gender: 'male',
    quality: 'high',
    dataset: 'lessac',
  },
  {
    voiceId: 'en_US-lessac-merged',
    name: 'Lessac (Merged)',
    language: 'en-US',
    gender: 'male',
    quality: 'high',
    dataset: 'lessac',
  },
  // English GB voices
  {
    voiceId: 'en_GB-alan-medium',
    name: 'Alan (Medium)',
    language: 'en-GB',
    gender: 'male',
    quality: 'medium',
    dataset: 'alan',
  },
  {
    voiceId: 'en_GB-southern_english_female-medium',
    name: 'Southern English Female (Medium)',
    language: 'en-GB',
    gender: 'female',
    quality: 'medium',
    dataset: 'southern_english_female',
  },
  // German voices
  {
    voiceId: 'de_DE-thorsten-medium',
    name: 'Thorsten (Medium)',
    language: 'de-DE',
    gender: 'male',
    quality: 'medium',
    dataset: 'thorsten',
  },
  {
    voiceId: 'de_DE-kerstin-medium',
    name: 'Kerstin (Medium)',
    language: 'de-DE',
    gender: 'female',
    quality: 'medium',
    dataset: 'kerstin',
  },
  // French voices
  {
    voiceId: 'fr_FR-siwis-medium',
    name: 'Siwis (Medium)',
    language: 'fr-FR',
    gender: 'female',
    quality: 'medium',
    dataset: 'siwis',
  },
  // Spanish voices
  {
    voiceId: 'es_ES-sharvard-medium',
    name: 'Sharvard (Medium)',
    language: 'es-ES',
    gender: 'male',
    quality: 'medium',
    dataset: 'sharvard',
  },
  // Italian voices
  {
    voiceId: 'it_IT-riccardo-medium',
    name: 'Riccardo (Medium)',
    language: 'it-IT',
    gender: 'male',
    quality: 'medium',
    dataset: 'riccardo',
  },
  // Portuguese voices
  {
    voiceId: 'pt_BR-edresson-medium',
    name: 'Edresson (Medium)',
    language: 'pt-BR',
    gender: 'male',
    quality: 'medium',
    dataset: 'edresson',
  },
  // Polish voices
  {
    voiceId: 'pl_PL-ewon-medium',
    name: 'Ewon (Medium)',
    language: 'pl-PL',
    gender: 'male',
    quality: 'medium',
    dataset: 'ewon',
  },
  // Russian voices
  {
    voiceId: 'ru_RU-dmitri-medium',
    name: 'Dmitri (Medium)',
    language: 'ru-RU',
    gender: 'male',
    quality: 'medium',
    dataset: 'dmitri',
  },
  // Chinese voices
  {
    voiceId: 'zh_CN-huayan-medium',
    name: 'Huayan (Medium)',
    language: 'zh-CN',
    gender: 'female',
    quality: 'medium',
    dataset: 'huayan',
  },
  // Japanese voices
  {
    voiceId: 'ja_JP-kristin-medium',
    name: 'Kristin (Medium)',
    language: 'ja-JP',
    gender: 'female',
    quality: 'medium',
    dataset: 'kristin',
  },
  // Korean voices
  {
    voiceId: 'ko_KR-kyuwon-medium',
    name: 'Kyuwon (Medium)',
    language: 'ko-KR',
    gender: 'female',
    quality: 'medium',
    dataset: 'kyuwon',
  },
];

/**
 * Voice Manager for voice enumeration and selection
 * Provides access to available voices and manages selected voice preference
 */
export class VoiceManager {
  private modelManager: ModelManager;
  private selectedVoiceId: string | null = null;
  private initialized = false;

  /**
   * Create a new VoiceManager
   * @param modelManager - ModelManager instance for checking downloaded models
   */
  constructor(modelManager: ModelManager) {
    this.modelManager = modelManager;
  }

  /**
   * Initialize the voice manager
   * Loads the selected voice from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.modelManager.initialize();
    await this.loadSelectedVoice();
    this.initialized = true;
  }

  /**
   * Get list of all available Piper voices
   * @returns Array of voice metadata
   */
  getAvailableVoices(): VoiceMetadata[] {
    return PIPER_VOICES.map(voice => ({
      voiceId: voice.voiceId,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
    }));
  }

  /**
   * Get list of downloaded voices only
   * Filters available voices against downloaded models
   * @returns Array of voice metadata for downloaded voices
   */
  async getDownloadedVoices(): Promise<VoiceMetadata[]> {
    const downloadedModelIds = await this.modelManager.getDownloadedModels();

    return PIPER_VOICES.filter(voice =>
      downloadedModelIds.includes(voice.voiceId),
    ).map(voice => ({
      voiceId: voice.voiceId,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
    }));
  }

  /**
   * Get the currently selected voice
   * @returns Voice metadata or null if none selected
   */
  async getSelectedVoice(): Promise<VoiceMetadata | null> {
    if (!this.selectedVoiceId) {
      // Try to load from storage
      await this.loadSelectedVoice();
    }

    if (!this.selectedVoiceId) {
      return null;
    }

    const voice = PIPER_VOICES.find(v => v.voiceId === this.selectedVoiceId);
    if (!voice) {
      return null;
    }

    return {
      voiceId: voice.voiceId,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
    };
  }

  /**
   * Get the currently selected voice ID
   * @returns Voice ID or null if none selected
   */
  getSelectedVoiceId(): string | null {
    return this.selectedVoiceId;
  }

  /**
   * Select a voice and persist to storage
   * @param voiceId - The voice identifier to select
   */
  async selectVoice(voiceId: string): Promise<void> {
    // Verify voice exists
    const voice = PIPER_VOICES.find(v => v.voiceId === voiceId);
    if (!voice) {
      throw new Error(`Voice ${voiceId} not found`);
    }

    this.selectedVoiceId = voiceId;

    // Persist to AsyncStorage
    await AsyncStorage.setItem(STORAGE_KEY_SELECTED_VOICE, voiceId);
  }

  /**
   * Clear the selected voice
   */
  async clearSelectedVoice(): Promise<void> {
    this.selectedVoiceId = null;
    await AsyncStorage.removeItem(STORAGE_KEY_SELECTED_VOICE);
  }

  /**
   * Get the preview URL for a voice
   * @param voiceId - The voice identifier
   * @returns URL to preview audio sample
   */
  getVoicePreviewUrl(voiceId: string): string {
    // Piper provides preview samples at these URLs
    // Format: https://rhasspy.github.io/piper-voices/{language}/{dataset}/{voiceId}.wav
    const voice = PIPER_VOICES.find(v => v.voiceId === voiceId);
    if (!voice) {
      return '';
    }

    // Convert voiceId format: en_US-ryan-medium -> en/us/ryan_medium
    const parts = voiceId.split('-');
    if (parts.length < 3) {
      return '';
    }

    const language = parts[0].replace('_', '/');
    const dataset = parts[1];
    const quality = parts.slice(2).join('_');

    return `https://rhasspy.github.io/piper-voices/${language}/${dataset}/${quality}.wav`;
  }

  /**
   * Get voice metadata by ID
   * @param voiceId - The voice identifier
   * @returns Voice metadata or undefined
   */
  getVoiceById(voiceId: string): VoiceMetadata | undefined {
    const voice = PIPER_VOICES.find(v => v.voiceId === voiceId);
    if (!voice) {
      return undefined;
    }

    return {
      voiceId: voice.voiceId,
      name: voice.name,
      language: voice.language,
      gender: voice.gender,
    };
  }

  /**
   * Get voices filtered by language
   * @param language - Language code (e.g., 'en-US', 'de-DE')
   * @returns Array of voice metadata
   */
  getVoicesByLanguage(language: string): VoiceMetadata[] {
    return PIPER_VOICES.filter(voice => voice.language === language).map(
      voice => ({
        voiceId: voice.voiceId,
        name: voice.name,
        language: voice.language,
        gender: voice.gender,
      }),
    );
  }

  /**
   * Get unique languages from available voices
   * @returns Array of language codes
   */
  getAvailableLanguages(): string[] {
    const languages = new Set(PIPER_VOICES.map(voice => voice.language));
    return Array.from(languages).sort();
  }

  /**
   * Load selected voice from AsyncStorage
   */
  private async loadSelectedVoice(): Promise<void> {
    try {
      const storedVoiceId = await AsyncStorage.getItem(
        STORAGE_KEY_SELECTED_VOICE,
      );
      if (storedVoiceId) {
        // Verify the voice still exists
        const voice = PIPER_VOICES.find(v => v.voiceId === storedVoiceId);
        if (voice) {
          this.selectedVoiceId = storedVoiceId;
        } else {
          // Clear invalid stored voice
          await this.clearSelectedVoice();
        }
      }
    } catch (error) {
      console.error('Failed to load selected voice:', error);
    }
  }

  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
