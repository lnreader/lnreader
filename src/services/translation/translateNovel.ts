/**
 * Bulk translation of a single novel, run as a background task (spec §6.3).
 *
 * Library-wide bulk translation is deliberately **not** offered: one tap would
 * fan out to thousands of chapters against a metered, user-paid API with no
 * natural stopping point. A novel is a bounded, visible unit of work.
 *
 * Structured like `downloadChapters`: sequential, checkpointed after every
 * chapter, and reporting per-chapter failures at the end rather than aborting
 * the run on the first one.
 */
import NativeFile from '@modules/native-file';
import { getString } from '@i18n/translations';
import { fetchChapter } from '@services/plugin/fetch';
import { sanitizeChapterText } from '@screens/reader/utils/sanitizeChapterText';
import { NOVEL_STORAGE } from '@utils/Storages';
import { sleep } from '@utils/sleep';
import { getTranslationSettings } from '@hooks/persisted/useTranslationSettings';
import { getNovelTranslationSettings } from '@hooks/persisted/useNovelTranslationSettings';
import type {
  BackgroundTaskExecutionContext,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';

import { hasTranslatedChapter } from './storage';
import { translateChapter } from './translateChapter';
import { parseTranslationCheckpoint } from './translationCheckpoint';
import { TranslationError } from './types';

export type TranslateNovelChapter = {
  chapterId: number;
  chapterName: string;
  /** Plugin-relative path, used when the chapter is not downloaded. */
  chapterPath: string;
};

export type TranslateNovelData = {
  novelId: number;
  novelName: string;
  pluginId: string;
  chapters: TranslateNovelChapter[];
};

/**
 * Reads a chapter the way the reader does: local file first, plugin as
 * fallback, then sanitize.
 *
 * Sanitizing here is not optional. The reader translates already-sanitized
 * HTML and renders cached translations directly, so a task that wrote raw
 * plugin HTML into the same cache would put unsanitized markup on screen.
 */
const loadChapterHtml = async (
  pluginId: string,
  novelId: number,
  novelName: string,
  chapter: TranslateNovelChapter,
): Promise<string> => {
  const filePath = `${NOVEL_STORAGE}/${pluginId}/${novelId}/${chapter.chapterId}/index.html`;

  let raw: string;
  try {
    raw = await NativeFile.readFile(filePath);
  } catch {
    raw = await fetchChapter(pluginId, chapter.chapterPath);
  }

  return sanitizeChapterText(pluginId, novelName, chapter.chapterName, raw);
};

export const translateNovelChapters = async (
  { novelId, novelName, pluginId, chapters }: TranslateNovelData,
  setMeta: TaskProgressUpdater,
  context: BackgroundTaskExecutionContext,
) => {
  if (!chapters.length) {
    return;
  }

  const settings = getTranslationSettings();
  const novelSettings = getNovelTranslationSettings(novelId);
  // A per-novel override wins; otherwise the novel follows the global choice.
  const targetLang = novelSettings.targetLang ?? settings.targetLang;

  const checkpoint = parseTranslationCheckpoint(
    context.checkpoint,
    chapters.length,
  );
  const failures = [...checkpoint.failures];

  for (let index = checkpoint.nextIndex; index < chapters.length; index++) {
    const chapter = chapters[index];

    setMeta(meta => ({
      ...meta,
      isRunning: true,
      progress: index / chapters.length,
      progressText: `${index + 1}/${chapters.length} · ${chapter.chapterName}`,
    }));

    try {
      const location = { pluginId, novelId, chapterId: chapter.chapterId };

      // Skip work already done. This makes a re-run after a partial failure
      // cheap, and means a novel translated in the reader isn't paid for
      // twice.
      if (!(await hasTranslatedChapter(location, targetLang))) {
        const html = await loadChapterHtml(
          pluginId,
          novelId,
          novelName,
          chapter,
        );

        const result = await translateChapter(location, {
          html,
          config: settings.config,
          targetLang,
          sourceLang: settings.sourceLang,
          chunkSize: settings.chunkSize,
          requestDelayMs: settings.requestDelayMs,
          requestTimeoutMs: settings.requestTimeoutMs,
        });

        if (!result.complete && !result.empty) {
          failures.push(
            `${chapter.chapterName}: ${result.failures.length}/${result.totalChunks} sections failed`,
          );
        }

        // The orchestrator paces chunks within a chapter but not across
        // chapters, so the same delay is applied between them.
        if (settings.requestDelayMs > 0 && index < chapters.length - 1) {
          await sleep(settings.requestDelayMs);
        }
      }
    } catch (error) {
      failures.push(
        `${chapter.chapterName}: ${
          error instanceof TranslationError || error instanceof Error
            ? error.message
            : String(error)
        }`,
      );
    }

    await context.updateCheckpoint(
      JSON.stringify({ nextIndex: index + 1, failures }),
    );
  }

  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));

  if (failures.length) {
    throw new Error(
      getString('translation.bulkFailures', {
        failed: failures.length,
        total: chapters.length,
      }) + `: ${failures.join('; ')}`,
    );
  }
};
