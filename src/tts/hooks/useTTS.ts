import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTTSPlayer, type PlayerController } from '../index';
import { EngineType } from '../engines/TTSEngine';
import type { VoiceMetadata } from '../models/VoiceMetadata';

/**
 * Storage keys for TTS preferences
 */
const STORAGE_KEY_ENGINE = 'tts_engine';
const STORAGE_KEY_SPEED = 'tts_speed';

/**
 * Default TTS speed
 */
const DEFAULT_SPEED = 1.0;

/**
 * TTS Hook return type
 */
export interface UseTTSReturn {
  // Playback controls
  play: (text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;

  // Settings
  setSpeed: (speed: number) => void;
  setVoice: (voiceId: string) => void;
  setEngine: (engineType: EngineType) => Promise<void>;

  // Status
  isPlaying: boolean;
  isPaused: boolean;
  isInitialized: boolean;
  currentEngine: EngineType;
  currentSpeed: number;
  currentVoice: VoiceMetadata | null;

  // Voice management
  downloadVoice: (
    voiceId: string,
    onProgress?: (progress: number) => void,
  ) => Promise<void>;
  isVoiceDownloaded: (voiceId: string) => Promise<boolean>;
  getAvailableVoices: () => VoiceMetadata[];
  getDownloadedVoices: () => Promise<VoiceMetadata[]>;
}

/**
 * React hook for TTS functionality
 * Provides reactive playback controls and settings management
 */
export const useTTS = (): UseTTSReturn => {
  const playerRef = useRef<PlayerController | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentEngine, setCurrentEngine] = useState<EngineType>(
    EngineType.NATIVE,
  );
  const [currentSpeed, setCurrentSpeedState] = useState(DEFAULT_SPEED);
  const [currentVoice, setCurrentVoice] = useState<VoiceMetadata | null>(null);

  // Initialize TTS on mount
  useEffect(() => {
    const initTTS = async () => {
      try {
        const player = getTTSPlayer();
        await player.initialize();
        playerRef.current = player;

        // Load preferences
        const [savedEngine, savedSpeed] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_ENGINE),
          AsyncStorage.getItem(STORAGE_KEY_SPEED),
        ]);

        if (savedEngine === EngineType.OFFLINE) {
          await player.setEngine(EngineType.OFFLINE);
          setCurrentEngine(EngineType.OFFLINE);
        }

        const speed = savedSpeed ? parseFloat(savedSpeed) : DEFAULT_SPEED;
        player.setSpeed(speed);
        setCurrentSpeedState(speed);

        // Load current voice
        const voice = await player.getCurrentVoice();
        setCurrentVoice(voice);

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize TTS:', err);
      }
    };

    initTTS();
  }, []);

  // Playback controls
  const play = useCallback(async (text: string): Promise<void> => {
    if (!playerRef.current) {
      throw new Error('TTS not initialized');
    }

    try {
      await playerRef.current.play(text);
      setIsPlaying(true);
      setIsPaused(false);
    } catch (err) {
      console.error('Play failed:', err);
      throw err;
    }
  }, []);

  const pause = useCallback((): void => {
    if (!playerRef.current) return;

    playerRef.current.pause();
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const resume = useCallback((): void => {
    if (!playerRef.current) return;

    playerRef.current.resume();
    setIsPlaying(true);
    setIsPaused(false);
  }, []);

  const stop = useCallback((): void => {
    if (!playerRef.current) return;

    playerRef.current.stop();
    setIsPlaying(false);
    setIsPaused(false);
  }, []);

  // Settings controls
  const setSpeed = useCallback((speed: number): void => {
    if (!playerRef.current) return;

    const clampedSpeed = Math.max(0.5, Math.min(2.0, speed));
    playerRef.current.setSpeed(clampedSpeed);
    setCurrentSpeedState(clampedSpeed);

    // Persist preference
    AsyncStorage.setItem(STORAGE_KEY_SPEED, clampedSpeed.toString()).catch(
      console.error,
    );
  }, []);

  const setVoice = useCallback((voiceId: string): void => {
    if (!playerRef.current) return;

    playerRef.current.setVoice(voiceId);

    // Update local state
    const voices = playerRef.current.getAvailableVoices();
    const voice = voices.find(v => v.voiceId === voiceId);
    if (voice) {
      setCurrentVoice(voice);
    }
  }, []);

  const setEngine = useCallback(
    async (engineType: EngineType): Promise<void> => {
      if (!playerRef.current) return;

      await playerRef.current.setEngine(engineType);
      setCurrentEngine(engineType);

      // Persist preference
      AsyncStorage.setItem(STORAGE_KEY_ENGINE, engineType).catch(console.error);
    },
    [],
  );

  // Voice management
  const downloadVoice = useCallback(
    async (
      voiceId: string,
      onProgress?: (progress: number) => void,
    ): Promise<void> => {
      if (!playerRef.current) {
        throw new Error('TTS not initialized');
      }

      await playerRef.current.downloadVoice(
        voiceId,
        onProgress ? p => onProgress(p.percentage) : undefined,
      );
    },
    [],
  );

  const isVoiceDownloaded = useCallback(
    async (voiceId: string): Promise<boolean> => {
      if (!playerRef.current) return false;
      return playerRef.current.isVoiceDownloaded(voiceId);
    },
    [],
  );

  const getAvailableVoices = useCallback((): VoiceMetadata[] => {
    if (!playerRef.current) return [];
    return playerRef.current.getAvailableVoices();
  }, []);

  const getDownloadedVoices = useCallback(async (): Promise<
    VoiceMetadata[]
  > => {
    if (!playerRef.current) return [];
    return playerRef.current.getDownloadedVoices();
  }, []);

  return {
    // Playback controls
    play,
    pause,
    resume,
    stop,

    // Settings
    setSpeed,
    setVoice,
    setEngine,

    // Status
    isPlaying,
    isPaused,
    isInitialized,
    currentEngine,
    currentSpeed,
    currentVoice,

    // Voice management
    downloadVoice,
    isVoiceDownloaded,
    getAvailableVoices,
    getDownloadedVoices,
  };
};
