/**
 * Shared types for the NoveLA-style chapter translation feature.
 */

export type TranslationProvider =
  | 'GOOGLE_PA'
  | 'GOOGLE_FREE'
  | 'GEMINI'
  | 'OPENAI';

export const TRANSLATION_PROVIDERS: readonly TranslationProvider[] = [
  'GOOGLE_PA',
  'GOOGLE_FREE',
  'GEMINI',
  'OPENAI',
] as const;

/**
 * How original and translated text coexist on screen and in TTS.
 * TTS reads the primary side ("first") and falls back to the other when a
 * paragraph has no translation yet, mirroring NoveLA's ttsText logic.
 */
export type TranslationParallelMode =
  | 'ORIGINAL_ONLY'
  | 'TRANSLATED_ONLY'
  | 'PARALLEL_ORIGINAL_FIRST'
  | 'PARALLEL_TRANSLATION_FIRST';

export const TRANSLATION_PARALLEL_MODES: readonly TranslationParallelMode[] = [
  'ORIGINAL_ONLY',
  'TRANSLATED_ONLY',
  'PARALLEL_ORIGINAL_FIRST',
  'PARALLEL_TRANSLATION_FIRST',
] as const;

/** One user-defined regex cleanup rule (global or per-novel). */
export interface RegexCleanupRule {
  /** Literal text or a `/pattern/flags` regex string. */
  pattern: string;
  replacement: string;
  enabled: boolean;
}

/** A user-defined translation prompt. */
export interface TranslationPrompt {
  id: string;
  name: string;
  content: string;
}

export type TranslationApiErrorCode =
  | 'MISSING_KEY'
  | 'GOOGLE_FREE'
  | 'GOOGLE_PA'
  | 'GEMINI'
  | 'OPENAI'
  | 'NETWORK';

export class TranslationError extends Error {
  readonly code: TranslationApiErrorCode;

  constructor(code: TranslationApiErrorCode, message: string) {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
  }
}
