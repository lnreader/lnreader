/**
 * Persisted translation settings.
 *
 * Per spec §4, provider configuration is a single discriminated-union object
 * rather than a flat bag of per-vendor fields, and it lives in the settings
 * store rather than the novel table. API keys are the one thing that does NOT
 * live here — they are held in the encrypted store (`translation/secureStorage`).
 */
import { useMMKVObject } from 'react-native-mmkv';
import { useCallback, useMemo } from 'react';

import { getMMKVObject } from '@utils/mmkv/mmkv';
import {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_REQUEST_DELAY_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  getDefaultConfig,
  type SourceLanguage,
  type TranslationConfig,
  type TranslationProviderId,
} from '@services/translation';

export const TRANSLATION_SETTINGS = 'TRANSLATION_SETTINGS';

export interface TranslationSettings {
  /**
   * User-facing on/off. Distinct from "configured": a provider needing a key
   * that has not been entered is enabled but unusable, and the reader control
   * stays hidden either way.
   */
  enabled: boolean;
  config: TranslationConfig;
  targetLang: string;
  sourceLang: SourceLanguage;
  chunkSize: number;
  requestDelayMs: number;
  requestTimeoutMs: number;
}

export const defaultTranslationSettings: TranslationSettings = {
  enabled: false,
  config: getDefaultConfig('libretranslate'),
  targetLang: 'en',
  sourceLang: 'auto',
  chunkSize: DEFAULT_CHUNK_SIZE,
  requestDelayMs: DEFAULT_REQUEST_DELAY_MS,
  requestTimeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
};

/** Non-reactive read, for background services outside the React tree. */
export const getTranslationSettings = (): TranslationSettings => ({
  ...defaultTranslationSettings,
  ...getMMKVObject<Partial<TranslationSettings>>(TRANSLATION_SETTINGS),
});

export const useTranslationSettings = () => {
  const [settings, setSettings] =
    useMMKVObject<TranslationSettings>(TRANSLATION_SETTINGS);

  const merged = useMemo(
    () => ({ ...defaultTranslationSettings, ...settings }),
    [settings],
  );

  const setTranslationSettings = useCallback(
    (patch: Partial<TranslationSettings>) => {
      setSettings({ ...merged, ...patch });
    },
    [merged, setSettings],
  );

  /**
   * Switching provider replaces the whole config object rather than merging,
   * so fields belonging to the previous provider cannot survive into the new
   * one — the point of the discriminated union.
   */
  const setProvider = useCallback(
    (providerId: TranslationProviderId) => {
      if (providerId !== merged.config.provider) {
        setSettings({ ...merged, config: getDefaultConfig(providerId) });
      }
    },
    [merged, setSettings],
  );

  /** Patches within the active provider's config, preserving its discriminant. */
  const setProviderConfig = useCallback(
    (patch: Partial<Omit<TranslationConfig, 'provider'>>) => {
      setSettings({
        ...merged,
        config: { ...merged.config, ...patch } as TranslationConfig,
      });
    },
    [merged, setSettings],
  );

  return {
    ...merged,
    setTranslationSettings,
    setProvider,
    setProviderConfig,
  };
};
