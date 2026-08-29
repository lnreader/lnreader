/**
 * Built-in and user-defined translation prompts.
 *
 * Prompts are formatted with language placeholders before being sent to a
 * provider. When no prompt is selected, providers translate without a system
 * instruction.
 */

import type { TranslationPrompt } from './types';

export type BuiltInPromptId =
  | 'minimal'
  | 'balanced'
  | 'detailed'
  | 'adult'
  | 'direct-asian';

export const DEFAULT_PROMPT_ID: BuiltInPromptId = 'balanced';

const PROMPT_FALLBACK_SOURCE = 'Auto-detect';

export const BUILT_IN_PROMPTS: Record<
  BuiltInPromptId,
  { name: string; content: string }
> = {
  minimal: {
    name: 'Minimal',
    content:
      'Translate from {source_language} to {target_language}. Output only the translation.',
  },
  balanced: {
    name: 'Balanced (Default)',
    content:
      'You are a professional translator. Translate the following text from {source_language} to {target_language} naturally and accurately, preserving the original meaning, tone, and style. Output only the translation.',
  },
  detailed: {
    name: 'Detailed',
    content:
      'You are an expert light novel translator. Translate the following text from {source_language} to {target_language} with high fidelity to the original meaning, nuance, tone, and style. Preserve character names and translate culturally specific terms where a reader would understand them. Output only the translation.',
  },
  adult: {
    name: 'Adult (18+)',
    content:
      'Translate the following text from {source_language} to {target_language}. The text may contain mature themes; translate them faithfully without censoring or softening. Output only the translation.',
  },
  'direct-asian': {
    name: 'Direct Asian',
    content:
      'Translate the following text from {source_language} to {target_language} preserving the direct, terse style typical of Asian light novels. Keep sentence structure and emphasis close to the original. Output only the translation.',
  },
};

const displayLanguage = (code: string): string =>
  code && code.trim().length > 0 && code.trim().toLowerCase() !== 'auto'
    ? code.trim()
    : PROMPT_FALLBACK_SOURCE;

/** Fill the `{source_language}` / `{target_language}` placeholders. */
export const formatPrompt = (
  content: string,
  sourceLanguage: string,
  targetLanguage: string,
): string =>
  content
    .replace(/\{source_language\}/g, displayLanguage(sourceLanguage))
    .replace(/\{target_language\}/g, displayLanguage(targetLanguage));

/**
 * Resolve a prompt id to its raw content.
 * Returns undefined for `null` (no prompt) or unknown ids.
 */
export const resolvePrompt = (
  promptId: string | undefined | null,
  customPrompts: TranslationPrompt[],
): string | undefined => {
  if (promptId == null) return undefined;
  const builtIn = BUILT_IN_PROMPTS[promptId as BuiltInPromptId];
  if (builtIn) return builtIn.content;
  return customPrompts.find(p => p.id === promptId)?.content;
};
