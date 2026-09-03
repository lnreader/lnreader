import { useCallback, useEffect, useMemo, useRef } from 'react';
import WebView from 'react-native-webview';
import { computeEffectiveTranslationSettings } from '@api/translation/settings';
import { formatPrompt, resolvePrompt } from '@api/translation/prompts';
import { applyRegexCleanupRules } from '@api/translation/regexCleanup';
import { translateParagraphs } from '@api/translation';
import {
  getChapterTranslationFromDb,
  upsertChapterTranslation,
  type ChapterTranslationKey,
} from '@database/queries/ChapterTranslationQueries';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';
import { useChapterContext } from '../ChapterContext';
import {
  getTranslationSettings,
  setAppTranslationSettings,
  useTranslationSettings,
  type EffectiveTranslationSettings,
} from '@hooks/persisted/useTranslationSettings';

type EffectiveKey = keyof EffectiveTranslationSettings;

const serialise = (value: unknown): string => JSON.stringify(value);

/**
 * Bridges chapter translation between the WebView engine (`core.js`) and the
 * provider layer. The page owns the DOM mutation; this hook resolves the
 * effective settings, reads/writes the offline cache, and re-runs translation
 * only when the settings that affect it actually change.
 */
export const useChapterTranslation = (
  webViewRef: React.RefObject<WebView<object> | null>,
  activeChapterIdRef: React.MutableRefObject<number>,
) => {
  const { novel, chapter } = useChapterContext();
  const settings = useTranslationSettings();

  const effective = useMemo(
    () => computeEffectiveTranslationSettings(settings, novel.id),
    [novel.id, settings],
  );

  const appliedRef = useRef<EffectiveTranslationSettings | null>(null);

  const inject = useCallback(
    (script: string) => {
      webViewRef.current?.injectJavaScript(`${script}; true;`);
    },
    [webViewRef],
  );

  const pushConfig = useCallback(
    (config: {
      enabled: boolean;
      parallelMode: EffectiveTranslationSettings['parallelMode'];
    }) => {
      inject(
        `window.reader?.applyTranslationConfig?.(${JSON.stringify(config)})`,
      );
    },
    [inject],
  );

  const requestTranslation = useCallback(() => {
    inject('window.reader?.requestTranslation?.()');
  }, [inject]);

  // Re-translate (or switch the parallel mode / disable) whenever the stored
  // settings change while a chapter is on screen.
  useEffect(() => {
    const chapterId = chapter.id;
    const previous = appliedRef.current;
    appliedRef.current = effective;

    if (!previous) return; // initial load is driven by onLoadEnd

    const fieldsChanged = (...fields: EffectiveKey[]) =>
      fields.some(field =>
        field === 'regexRules'
          ? serialise(previous[field]) !== serialise(effective[field])
          : previous[field] !== effective[field],
      );

    if (!effective.enabled) {
      if (previous.enabled) {
        pushConfig({ enabled: false, parallelMode: effective.parallelMode });
      }
      return;
    }

    if (activeChapterIdRef.current === chapterId) {
      // The page guards requestTranslation() on config.enabled, so always push
      // the config first — enabling mid-chapter must reach the page enabled.
      if (previous.enabled === false) {
        pushConfig({ enabled: true, parallelMode: effective.parallelMode });
        requestTranslation();
      } else if (
        fieldsChanged(
          'provider',
          'providerFingerprint',
          'sourceLanguage',
          'targetLanguage',
          'promptId',
          'regexRules',
        )
      ) {
        requestTranslation();
      } else if (previous.parallelMode !== effective.parallelMode) {
        pushConfig({ enabled: true, parallelMode: effective.parallelMode });
      }
    }
  }, [
    activeChapterIdRef,
    chapter.id,
    effective,
    pushConfig,
    requestTranslation,
  ]);

  /**
   * Responds to a `translation-request` posted by the page: cleans the originals
   * with the effective regex rules, translates (serving from the offline cache
   * when possible) and pushes the result back into the page.
   */
  const onTranslationRequest = useCallback(
    (paragraphs: string[], force = false) => {
      if (!effective.enabled) return;
      const chapterId = chapter.id;
      const cleanOriginals = paragraphs.map(paragraph =>
        applyRegexCleanupRules(paragraph, effective.regexRules),
      );

      const cacheKey: ChapterTranslationKey = {
        novelId: novel.id,
        path: chapter.path,
        provider: effective.provider,
        sourceLanguage: effective.sourceLanguage,
        targetLanguage: effective.targetLanguage,
      };

      const apply = (translations: string[]) => {
        if (activeChapterIdRef.current !== chapterId) return;
        inject(
          `window.reader?.applyTranslation?.(${JSON.stringify({
            config: {
              enabled: true,
              parallelMode: effective.parallelMode,
            },
            paragraphs: cleanOriginals,
            translations,
          })})`,
        );
      };

      void (async () => {
        try {
          const cached = force
            ? null
            : await getChapterTranslationFromDb(cacheKey);
          if (cached) {
            apply(cached);
            return;
          }
          const current = getTranslationSettings();
          const promptContent = resolvePrompt(
            effective.promptId,
            current.prompts,
          );
          const translations = await translateParagraphs({
            provider: effective.provider,
            texts: cleanOriginals,
            sourceLanguage: effective.sourceLanguage,
            targetLanguage: effective.targetLanguage,
            systemPrompt: promptContent
              ? formatPrompt(
                  promptContent,
                  effective.sourceLanguage,
                  effective.targetLanguage,
                )
              : undefined,
            googlePaApiKey: current.googlePaApiKey,
            useCommunityGooglePaKey: current.useCommunityGooglePaKey,
            googlePaApiKeys: current.googlePaApiKeys,
            googlePaCachedKey: current.googlePaCachedKey,
            googlePaKeyLastChecked: current.googlePaKeyLastChecked,
            persistGooglePaKeyCache: (
              googlePaCachedKey,
              googlePaKeyLastChecked,
            ) =>
              setAppTranslationSettings({
                googlePaCachedKey,
                googlePaKeyLastChecked,
              }),
            persistGooglePaApiKeys: googlePaApiKeys =>
              setAppTranslationSettings({
                googlePaApiKeys: googlePaApiKeys.join('\n'),
              }),
            geminiApiKey: current.geminiApiKey,
            geminiModel: current.geminiModel,
            openaiApiKey: current.openaiApiKey,
            openaiEndpoint: current.openaiEndpoint,
            openaiModel: current.openaiModel,
            batchSize: current.batchSize,
            maxOutputTokens: current.maxOutputTokens,
          });
          if (activeChapterIdRef.current !== chapterId) return;
          void upsertChapterTranslation(cacheKey, translations);
          apply(translations);
        } catch {
          if (activeChapterIdRef.current === chapterId) {
            showToast(getString('readerScreen.translationError'));
          }
        }
      })();
    },
    [activeChapterIdRef, chapter.id, chapter.path, effective, inject, novel.id],
  );

  return {
    translationEnabled: effective.enabled,
    parallelMode: effective.parallelMode,
    requestTranslation,
    pushConfig,
    onTranslationRequest,
  };
};
