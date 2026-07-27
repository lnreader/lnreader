/**
 * In-app chapter translation.
 *
 * Public surface of the translation service. See
 * `docs/specs/chapter-translation.md` for the design this implements.
 */
export * from './types';
export {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_REQUEST_DELAY_MS,
  DEFAULT_REQUEST_TIMEOUT_MS,
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  clampChunkSize,
  splitIntoChunks,
  type TranslationChunk,
} from './chunking';
export { segmentHtml, type SegmentedDocument } from './htmlSegments';
export {
  chapterFolderPath,
  deleteAllTranslations,
  deleteTranslatedChapter,
  hasTranslatedChapter,
  isTranslationFile,
  readTranslatedChapter,
  translatedChapterPath,
  writeTranslatedChapter,
  type ChapterLocation,
} from './storage';
export { deleteApiKey, getApiKey, hasApiKey, setApiKey } from './secureStorage';
export {
  TRANSLATION_PROVIDER_IDS,
  getDefaultConfig,
  getTranslationProvider,
  isLocalProvider,
} from './providers';
export {
  translateChapter,
  translateChapterHtml,
  type ChunkFailure,
  type TranslateChapterOptions,
  type TranslateChapterResult,
} from './translateChapter';
