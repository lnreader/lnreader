/**
 * Per-chapter translation state for the reader.
 *
 * Implements spec §6.1: a toggle that swaps the displayed text between the
 * translated and original version of the current chapter, with the choice
 * remembered per chapter for the session.
 *
 * Composed in `ChapterContext` rather than inside `useChapter` so the chapter
 * loading pipeline stays untouched — this hook only ever transforms the HTML
 * `useChapter` already produced.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';
import {
  TranslationError,
  getTranslationProvider,
  hasApiKey,
  readTranslatedChapter,
  translateChapter,
  type ChunkFailure,
} from '@services/translation';
import { useTranslationSettings } from '@hooks/persisted/useTranslationSettings';

/** Stable identity so resetting failures never triggers a render loop. */
const NO_FAILURES: ChunkFailure[] = [];

export interface ChapterTranslation {
  /** Whether to render the translate control at all (spec option (c)). */
  translationAvailable: boolean;
  /** Whether the translated text is currently on screen. */
  showTranslation: boolean;
  translating: boolean;
  /** Chunks that failed in the last run, for a partial-failure notice. */
  translationFailures: ChunkFailure[];
  toggleTranslation: () => void;
}

export default function useChapterTranslation(
  novel: NovelInfo,
  chapter: ChapterInfo,
  originalHtml: string,
) {
  const { enabled, config, targetLang, sourceLang, ...settings } =
    useTranslationSettings();

  const [keyPresent, setKeyPresent] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translatedHtml, setTranslatedHtml] = useState<string>();
  const [translating, setTranslating] = useState(false);
  const [translationFailures, setTranslationFailures] =
    useState<ChunkFailure[]>(NO_FAILURES);
  /** Lets chapter changes reset state during render instead of in an effect. */
  const [renderedChapterId, setRenderedChapterId] = useState(chapter.id);

  /**
   * Which chapters the reader has toggled on this session. Spec §6.1 asks for
   * the choice to survive navigation within a session without persisting it,
   * so a ref is the whole mechanism.
   */
  const sessionToggles = useRef(new Map<number, boolean>());
  const abortRef = useRef<AbortController>(null);
  /** Guards against a slow translation publishing after the chapter changed. */
  const chapterIdRef = useRef(chapter.id);

  useEffect(() => {
    chapterIdRef.current = chapter.id;
  }, [chapter.id]);

  /**
   * Whether the active provider needs a key. Derived during render — only the
   * lookup of whether that key actually exists has to be asynchronous.
   */
  const keyRequired = useMemo(
    () =>
      enabled && getTranslationProvider(config.provider).requiresApiKey(config),
    [enabled, config],
  );

  useEffect(() => {
    if (!keyRequired) {
      return undefined;
    }
    let cancelled = false;

    hasApiKey(config.provider)
      .then(present => {
        if (!cancelled) {
          setKeyPresent(present);
        }
      })
      // A secure-store failure means we cannot prove the key exists, so the
      // control stays hidden rather than promising something that won't work.
      .catch(() => {
        if (!cancelled) {
          setKeyPresent(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [keyRequired, config.provider]);

  /**
   * A provider needing a key it doesn't have is not usable, and the control
   * stays hidden rather than appearing and then failing on tap.
   */
  const configured = enabled && (!keyRequired || keyPresent);

  const runTranslation = useCallback(
    async (chapterId: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setTranslating(true);
      setTranslationFailures(NO_FAILURES);

      const location = {
        pluginId: novel.pluginId,
        novelId: chapter.novelId,
        chapterId,
      };

      try {
        // A cached translation makes re-toggling free, and is what makes the
        // session-restore path below cheap.
        const cached = await readTranslatedChapter(location, targetLang);
        if (controller.signal.aborted || chapterIdRef.current !== chapterId) {
          return;
        }
        if (cached) {
          setTranslatedHtml(cached);
          setShowTranslation(true);
          sessionToggles.current.set(chapterId, true);
          return;
        }

        const result = await translateChapter(location, {
          html: originalHtml,
          config,
          targetLang,
          sourceLang,
          chunkSize: settings.chunkSize,
          requestDelayMs: settings.requestDelayMs,
          requestTimeoutMs: settings.requestTimeoutMs,
          signal: controller.signal,
        });

        if (controller.signal.aborted || chapterIdRef.current !== chapterId) {
          return;
        }

        if (result.empty) {
          showToast(getString('translation.nothingToTranslate'));
          return;
        }

        setTranslatedHtml(result.html);
        setShowTranslation(true);
        setTranslationFailures(result.failures);
        sessionToggles.current.set(chapterId, true);

        // Partial failure is surfaced rather than passed off as a clean
        // translation — the rest of the chapter is still readable.
        if (!result.complete) {
          showToast(
            getString('translation.partialFailure', {
              failed: result.failures.length,
              total: result.totalChunks,
            }),
          );
        }
      } catch (error) {
        if (controller.signal.aborted || chapterIdRef.current !== chapterId) {
          return;
        }
        showToast(
          error instanceof TranslationError
            ? error.message
            : getString('translation.failed'),
        );
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setTranslating(false);
        }
      }
    },
    [
      novel.pluginId,
      chapter.novelId,
      originalHtml,
      config,
      targetLang,
      sourceLang,
      settings.chunkSize,
      settings.requestDelayMs,
      settings.requestTimeoutMs,
    ],
  );

  // Drop the previous chapter's translation during render, so the reader never
  // paints one chapter's text against another's translation.
  if (chapter.id !== renderedChapterId) {
    setRenderedChapterId(chapter.id);
    setTranslating(false);
    setTranslatedHtml(undefined);
    setTranslationFailures(NO_FAILURES);
    setShowTranslation(false);
  }

  // Aborting an in-flight request is external cleanup, so it stays an effect.
  // The cleanup runs both on chapter change and on unmount.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [chapter.id],
  );

  /**
   * Restores a chapter the reader had already translated this session. Only
   * runs once the chapter's own text has loaded, since a cache miss falls
   * through to translating `originalHtml`.
   */
  useEffect(() => {
    if (
      !configured ||
      !originalHtml ||
      translatedHtml ||
      translating ||
      !sessionToggles.current.get(chapter.id)
    ) {
      return;
    }
    void runTranslation(chapter.id);
  }, [
    configured,
    originalHtml,
    translatedHtml,
    translating,
    chapter.id,
    runTranslation,
  ]);

  const toggleTranslation = useCallback(() => {
    if (translating) {
      return;
    }
    if (showTranslation) {
      setShowTranslation(false);
      sessionToggles.current.set(chapter.id, false);
      return;
    }
    if (translatedHtml) {
      setShowTranslation(true);
      sessionToggles.current.set(chapter.id, true);
      return;
    }
    void runTranslation(chapter.id);
  }, [
    translating,
    showTranslation,
    translatedHtml,
    chapter.id,
    runTranslation,
  ]);

  /**
   * Memoised as one object because it is spread into the chapter context.
   * `useChapter` goes to some length to keep that context referentially
   * stable — returning a fresh object here every render would undo it and
   * re-render the WebView, footer and drawer on every tick.
   */
  const translation: ChapterTranslation = useMemo(
    () => ({
      translationAvailable: configured,
      showTranslation,
      translating,
      translationFailures,
      toggleTranslation,
    }),
    [
      configured,
      showTranslation,
      translating,
      translationFailures,
      toggleTranslation,
    ],
  );

  return {
    translation,
    /** The HTML the reader should render. */
    displayedHtml:
      showTranslation && translatedHtml ? translatedHtml : originalHtml,
  };
}
