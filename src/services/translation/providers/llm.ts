/**
 * Shared prompt handling for LLM-backed providers (Gemini, Ollama, and the
 * Phase 2 additions).
 *
 * LLM providers differ from literal MT engines in that prose quality depends
 * on instruction: honorifics, speaker tone and dialogue punctuation are
 * routinely flattened without it. Spec §6.4 therefore makes the prompts
 * user-editable; these are the defaults.
 */
import { TranslationError } from '../types';

export const DEFAULT_SYSTEM_PROMPT = [
  'You are a professional literary translator working on a serialized web novel.',
  'Translate faithfully and naturally, preserving the author’s tone, register and pacing.',
  'Keep honorifics, character names and established terminology consistent.',
  'Preserve dialogue punctuation and paragraph breaks exactly as given.',
  'Do not summarize, censor, explain, or add notes.',
].join(' ');

export const DEFAULT_USER_PROMPT_TEMPLATE = [
  'Translate each element of the following JSON array from {SOURCE_LANG} into {TARGET_LANG}.',
  'Respond with ONLY a JSON array of strings, the same length and order as the input.',
  'Do not merge or split elements.',
  '',
  '{TEXT}',
].join('\n');

export const fillPromptTemplate = (
  template: string,
  values: { sourceLang: string; targetLang: string; text: string },
): string =>
  template
    .replaceAll('{SOURCE_LANG}', values.sourceLang)
    .replaceAll('{TARGET_LANG}', values.targetLang)
    .replaceAll('{TEXT}', values.text);

/** Models are told to emit bare JSON but routinely wrap it in a code fence. */
const stripCodeFence = (raw: string): string => {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
};

/**
 * Parses a model's reply into exactly `expectedLength` strings.
 *
 * A length mismatch is an error rather than something to pad or truncate: it
 * means the model merged or dropped paragraphs, so the output can no longer be
 * aligned with the source document and writing it back would silently scramble
 * the chapter.
 */
export const parseJsonArrayResponse = (
  raw: string,
  expectedLength: number,
  providerLabel: string,
): string[] => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    throw new TranslationError(
      'bad-response',
      `${providerLabel} did not return valid JSON.`,
    );
  }

  if (!Array.isArray(parsed)) {
    throw new TranslationError(
      'bad-response',
      `${providerLabel} returned ${typeof parsed}, expected a JSON array.`,
    );
  }

  if (parsed.length !== expectedLength) {
    throw new TranslationError(
      'bad-response',
      `${providerLabel} returned ${parsed.length} segments for ${expectedLength} inputs.`,
    );
  }

  return parsed.map(entry =>
    typeof entry === 'string' ? entry : String(entry),
  );
};

/** The batch payload models are asked to translate element-wise. */
export const encodeBatch = (texts: string[]): string => JSON.stringify(texts);
