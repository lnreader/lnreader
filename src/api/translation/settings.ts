/**
 * Pure translation settings model (no MMKV/RN imports). The persisted hook
 * stores/reads `TranslationSettings`; this module holds the defaults and the
 * effective per-novel resolution logic so it is unit-testable and reusable
 * from non-React code paths (reader bridge, nitro modules).
 */

import { DEFAULT_PROMPT_ID, type BuiltInPromptId } from './prompts';
import { DEFAULT_GEMINI_MODEL } from './gemini';
import { DEFAULT_OPENAI_ENDPOINT, DEFAULT_OPENAI_MODEL } from './openai';
import type {
  RegexCleanupRule,
  TranslationParallelMode,
  TranslationPrompt,
  TranslationProvider,
} from './types';

export interface PerNovelTranslationSettings {
  enabled?: boolean;
  sourceLanguage?: string;
  targetLanguage?: string;
  parallelMode?: TranslationParallelMode;
  /** `undefined` → global default; `null` → no prompt; id → that prompt. */
  promptId?: string | null;
  regexRules?: RegexCleanupRule[];
}

export interface TranslationSettings {
  /** Global master switch. Per-novel must also be enabled for the novel. */
  enabled: boolean;
  provider: TranslationProvider;
  parallelMode: TranslationParallelMode;
  sourceLanguage: string;
  targetLanguage: string;
  defaultPromptId: string;
  googlePaApiKey: string;
  /** Fall back to the shared community key when no personal key is set. */
  useCommunityGooglePaKey: boolean;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiEndpoint: string;
  openaiModel: string;
  /** User-defined prompts (built-ins are referenced by id directly). */
  prompts: TranslationPrompt[];
  regexRules: RegexCleanupRule[];
  /** Keyed by `String(novelId)`. */
  perNovel: Record<string, PerNovelTranslationSettings>;
}

export const initialTranslationSettings: TranslationSettings = {
  enabled: false,
  provider: 'GOOGLE_PA',
  parallelMode: 'PARALLEL_TRANSLATION_FIRST',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  defaultPromptId: DEFAULT_PROMPT_ID,
  googlePaApiKey: '',
  useCommunityGooglePaKey: true,
  geminiApiKey: '',
  geminiModel: DEFAULT_GEMINI_MODEL,
  openaiApiKey: '',
  openaiEndpoint: DEFAULT_OPENAI_ENDPOINT,
  openaiModel: DEFAULT_OPENAI_MODEL,
  prompts: [],
  regexRules: [],
  perNovel: {},
};

/** Merge stored values over defaults without mutating the stored object. */
export const mergeTranslationSettings = (
  stored?: Partial<TranslationSettings>,
): TranslationSettings => ({
  ...initialTranslationSettings,
  ...stored,
  perNovel: stored?.perNovel ?? {},
});

export interface EffectiveTranslationSettings {
  enabled: boolean;
  provider: TranslationProvider;
  sourceLanguage: string;
  targetLanguage: string;
  parallelMode: TranslationParallelMode;
  /**
   * `undefined` → use the global default prompt id;
   * `null` → translate without a prompt; string → that prompt's id.
   */
  promptId: string | undefined | null;
  regexRules: RegexCleanupRule[];
}

/**
 * Resolve the settings that actually apply to one novel: per-novel overrides
 * layered on top of the global defaults. Regex rules are `global ++ per-novel`
 * (matching NoveLA's `effectiveRegexRules`).
 */
export const computeEffectiveTranslationSettings = (
  settings: TranslationSettings,
  novelId: number | string,
): EffectiveTranslationSettings => {
  const per = settings.perNovel[String(novelId)];
  return {
    enabled: settings.enabled && (per?.enabled ?? true),
    provider: settings.provider,
    sourceLanguage: per?.sourceLanguage ?? settings.sourceLanguage,
    targetLanguage: per?.targetLanguage ?? settings.targetLanguage,
    parallelMode: per?.parallelMode ?? settings.parallelMode,
    promptId:
      per && 'promptId' in per ? per.promptId : settings.defaultPromptId,
    regexRules: [...(settings.regexRules ?? []), ...(per?.regexRules ?? [])],
  };
};

export type { BuiltInPromptId };
