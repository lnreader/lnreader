import { useMemo } from 'react';
import { useMMKVObject } from 'react-native-mmkv';
import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import {
  computeEffectiveTranslationSettings,
  mergeTranslationSettings,
  type PerNovelTranslationSettings,
  type TranslationSettings,
} from '@api/translation/settings';

export const TRANSLATION_SETTINGS = 'TRANSLATION_SETTINGS';

export type {
  EffectiveTranslationSettings,
  TranslationSettings,
  PerNovelTranslationSettings,
} from '@api/translation/settings';

/**
 * Non-reactive read; safe from background services, the reader bridge, and
 * settings-free code paths.
 */
export const getTranslationSettings = (): TranslationSettings =>
  mergeTranslationSettings(
    getMMKVObject<TranslationSettings>(TRANSLATION_SETTINGS),
  );

export const setAppTranslationSettings = (
  values: Partial<TranslationSettings>,
): void => {
  setMMKVObject<TranslationSettings>(TRANSLATION_SETTINGS, {
    ...getTranslationSettings(),
    ...values,
  });
};

export const getEffectiveTranslationSettings = (
  novelId: number | string,
): ReturnType<typeof computeEffectiveTranslationSettings> =>
  computeEffectiveTranslationSettings(getTranslationSettings(), novelId);

export const useTranslationSettings = () => {
  const [stored, setSettings] =
    useMMKVObject<TranslationSettings>(TRANSLATION_SETTINGS);

  const settings = useMemo(() => mergeTranslationSettings(stored), [stored]);

  const setTranslationSettings = (values: Partial<TranslationSettings>) =>
    setSettings({ ...settings, ...values });

  const setPerNovelTranslationSettings = (
    novelId: number | string,
    values: Partial<PerNovelTranslationSettings>,
  ) => {
    const key = String(novelId);
    const current = settings.perNovel[key] ?? {};
    setSettings({
      ...settings,
      perNovel: { ...settings.perNovel, [key]: { ...current, ...values } },
    });
  };

  return {
    ...settings,
    setTranslationSettings,
    setPerNovelTranslationSettings,
  };
};
