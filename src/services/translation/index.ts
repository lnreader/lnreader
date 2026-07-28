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
  DEFAULT_MAX_PARALLEL_TRANSLATIONS,
  MAX_PARALLEL_TRANSLATIONS,
  MIN_PARALLEL_TRANSLATIONS,
  clampChunkSize,
  clampParallelTranslations,
  splitIntoChunks,
  type TranslationChunk,
} from './chunking';
export { segmentHtml, type SegmentedDocument } from './htmlSegments';
export {
  TARGET_LANGUAGES,
  languageLabel,
  type TranslationLanguage,
} from './languages';
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
  fillHttpTemplate,
  languageDisplayName,
  resolveJsonPath,
} from './providers';
export {
  TEST_PHRASE,
  testProvider,
  type TestProviderResult,
} from './testProvider';
export {
  translateChapter,
  translateChapterHtml,
  type ChunkFailure,
  type TranslateChapterOptions,
  type TranslateChapterResult,
} from './translateChapter';
