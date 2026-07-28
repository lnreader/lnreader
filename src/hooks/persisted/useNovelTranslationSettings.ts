/**
 * Per-novel translation preferences.
 *
 * Spec constraint (§4, from PR #1851's review): these are *settings*, not
 * columns on the `Novel` table. They live under their own MMKV key per novel,
 * mirroring how `NOVEL_SETTINGS_PREFIX` scopes filter/sort per novel.
 *
 * A dedicated key rather than an extension of `NovelSettings`: that store is a
 * validated zustand domain store bound to the novel screen's lifecycle, and
 * translation needs to be readable from background paths (auto-translate on
 * download) that never mount it.
 */
import { useCallback } from 'react';
import { useMMKVObject } from 'react-native-mmkv';

import { getMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';

export const NOVEL_TRANSLATION_SETTINGS_PREFIX = 'NOVEL_TRANSLATION_SETTINGS';

export interface NovelTranslationSettings {
  /** Translate new chapters for this novel without the reader asking. */
  autoTranslate: boolean;
  /**
   * Overrides the global target language for this novel. Undefined means
   * "follow the global setting", which is different from having picked the
   * same language explicitly — the novel tracks the global one as it changes.
   */
  targetLang?: string;
}

export const defaultNovelTranslationSettings: NovelTranslationSettings = {
  autoTranslate: false,
};

export const novelTranslationSettingsKey = (novelId: number) =>
  `${NOVEL_TRANSLATION_SETTINGS_PREFIX}_${novelId}`;

/** Non-reactive read, for background services outside the React tree. */
export const getNovelTranslationSettings = (
  novelId: number,
): NovelTranslationSettings => ({
  ...defaultNovelTranslationSettings,
  ...getMMKVObject<Partial<NovelTranslationSettings>>(
    novelTranslationSettingsKey(novelId),
  ),
});

/** Drops a novel's preferences, e.g. when the novel is removed. */
export const deleteNovelTranslationSettings = (novelId: number) => {
  MMKVStorage.remove(novelTranslationSettingsKey(novelId));
};

export const useNovelTranslationSettings = (novelId: number) => {
  const [stored, setStored] = useMMKVObject<NovelTranslationSettings>(
    novelTranslationSettingsKey(novelId),
  );

  const settings = { ...defaultNovelTranslationSettings, ...stored };

  const setNovelTranslationSettings = useCallback(
    (patch: Partial<NovelTranslationSettings>) => {
      setStored({
        ...defaultNovelTranslationSettings,
        ...getMMKVObject<Partial<NovelTranslationSettings>>(
          novelTranslationSettingsKey(novelId),
        ),
        ...patch,
      });
    },
    [novelId, setStored],
  );

  return { ...settings, setNovelTranslationSettings };
};
