/**
 * Shared driver for raw-text chat-model providers (Gemini, OpenAI-compatible).
 *
 * Mirrors NoveLA's engine: paragraphs are sent as a numbered list ("1. text"),
 * the model replies with the same numbered format, and a tolerant parser maps
 * the lines back to the input positions. Missing or malformed items fall back
 * to the original text instead of failing the whole chapter. Transient HTTP
 * failures (429 / 5xx / timeout) are retried with a short backoff; a batch that
 * still fails only degrades those paragraphs, and the chapter translation is
 * only aborted when every batch fails.
 */

import { fetchTimeout } from '@utils/fetch/fetch';
import { TranslationError, type TranslationApiErrorCode } from './types';

const MAX_BATCH_SIZE = 20;
const MAX_BATCH_CHARS = 8000;
const REQUEST_TIMEOUT_MS = 120000;
const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 600;

const NUMBERED_LINE = /^\*{0,2}[№#]?\s*(\d+)\s*[.)]\*{0,2}\s*(.*)$/;
const BOLD_EDGE = /\*\*$/;

export interface ChatModelReply {
  parseText: (data: unknown) => string | undefined;
}

export interface ChatModelRequest {
  url: string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (payload: string, systemPrompt: string | undefined) => unknown;
  reply: ChatModelReply;
}

const buildBatches = (texts: string[]): string[][] => {
  const batches: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const text of texts) {
    if (
      current.length >= MAX_BATCH_SIZE ||
      (current.length > 0 && chars + text.length > MAX_BATCH_CHARS)
    ) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(text);
    chars += text.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
};

/** Number the paragraphs exactly like NoveLA so replies stay index-aligned. */
export const buildNumberedPayload = (texts: string[]): string =>
  texts.map((text, index) => `${index + 1}. ${text}`).join('\n');

/**
 * Map a numbered reply ("1. text", "1) text", "**1.** text", "№1. text")
 * back onto the input list positionally. Anything the model skipped or could
 * not be attributed to an index keeps its original text, so paragraph order
 * (and duplicates) always line up with the input.
 */
export const parseNumberedTranslations = (
  translatedText: string,
  originalTexts: string[],
): string[] => {
  const byIndex = new Map<number, string>();
  let currentIndex = -1;
  let currentText = '';

  const flush = () => {
    if (currentIndex >= 0 && currentText.trim()) {
      byIndex.set(currentIndex, currentText.trim().replace(BOLD_EDGE, ''));
    }
    currentText = '';
  };

  for (const rawLine of translatedText.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (/^```/.test(line)) continue; // code fences wrapping the whole answer
    const match = NUMBERED_LINE.exec(line);
    if (match) {
      flush();
      const number = Number.parseInt(match[1], 10);
      if (Number.isNaN(number) || number < 1) {
        currentIndex = -1;
        continue;
      }
      currentIndex = number - 1;
      if (match[2]) currentText = match[2];
      continue;
    }
    if (currentIndex < 0) continue; // preamble before the first item
    currentText = currentText ? `${currentText}\n${line}` : line;
  }
  flush();

  return originalTexts.map(
    (text, index) => byIndex.get(index) ?? text,
  );
};

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const translateChatTexts = async (
  request: ChatModelRequest,
  texts: string[],
  systemPrompt: string | undefined,
  options: { apiKey: string; errorCode: TranslationApiErrorCode },
): Promise<string[]> => {
  if (!options.apiKey) {
    throw new TranslationError('MISSING_KEY', 'No API key configured.');
  }

  const post = async (payload: string): Promise<string | undefined> => {
    let lastError: unknown;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetchTimeout(
          request.url,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...request.buildHeaders(options.apiKey),
            },
            body: JSON.stringify(request.buildBody(payload, systemPrompt)),
          },
          REQUEST_TIMEOUT_MS,
        );
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          if (response.status === 429 || response.status >= 500) {
            lastError = new TranslationError(
              options.errorCode,
              `Provider returned HTTP ${response.status}.`,
            );
            if (attempt < MAX_RETRIES) {
              await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
              continue;
            }
          }
          throw new TranslationError(
            options.errorCode,
            `Provider returned HTTP ${response.status}: ${body.slice(0, 200)}`,
          );
        }
        const data = await response.json().catch(() => null);
        const parsed = request.reply.parseText(data);
        if (typeof parsed !== 'string' || parsed.trim() === '') {
          throw new TranslationError(
            options.errorCode,
            'Provider returned no text.',
          );
        }
        return parsed;
      } catch (error) {
        lastError = error;
        if (attempt < MAX_RETRIES && isRetriable(error)) {
          await delay(RETRY_BASE_DELAY_MS * (attempt + 1));
          continue;
        }
        throw error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new TranslationError(options.errorCode, 'Provider request failed.');
  };

  const batches = buildBatches(texts);
  const results = [...texts];
  let succeeded = 0;
  let cursor = 0;
  let lastError: unknown = null;

  for (const batch of batches) {
    const start = cursor;
    cursor += batch.length;
    try {
      const reply = await post(buildNumberedPayload(batch));
      const parsed = parseNumberedTranslations(reply ?? '', batch);
      for (let i = 0; i < batch.length; i++) {
        results[start + i] = parsed[i];
      }
      succeeded++;
    } catch (error) {
      lastError = error;
    }
  }

  if (batches.length > 0 && succeeded === 0 && lastError) {
    throw lastError instanceof Error
      ? lastError
      : new TranslationError(
          options.errorCode,
          'Provider request failed for every batch.',
        );
  }
  return results;
};

const isRetriable = (error: unknown): boolean => {
  if (error instanceof TranslationError) {
    return error.message.includes('HTTP 429') || error.message.includes('HTTP 5');
  }
  return error instanceof Error; // network / timeout
};