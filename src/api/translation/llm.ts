/**
 * Shared driver for raw-text chat-model providers (Gemini, OpenAI-compatible).
 *
 * Mirrors NoveLA's engine: paragraphs are sent as a numbered list ("1. text"),
 * the model replies with the same numbered format, and a tolerant parser maps
 * the lines back to the input positions. Missing or malformed items fall back
 * to the original text instead of failing the whole chapter.
 *
 * A chapter larger than the configured batch size (default 60 paragraphs per
 * request, matching NoveLA's TRANSLATION_BATCH_SIZE) is split recursively so a
 * large system prompt never pushes a single request past the model's output
 * token budget — the direct fix for "large prompt → chapter truncated".
 *
 * Multiple API keys (one per line, or comma/semicolon separated) are rotated
 * round-robin like NoveLA: 429/401/403 switch to the next key immediately,
 * 5xx and 400 retry the same key with backoff, and a batch that still fails
 * only degrades those paragraphs — the chapter translation is only aborted
 * when every batch fails.
 */

import { fetchTimeout } from '@utils/fetch/fetch';
import { TranslationError, type TranslationApiErrorCode } from './types';

export const DEFAULT_BATCH_SIZE = 60;
const RETRY_COUNT = 3;
const REQUEST_TIMEOUT_MS = 120000;
const STATUS_500_DELAY_BASE_MS = 2000;
const STATUS_400_DELAY_BASE_MS = 1000;
const EMPTY_REPLY_DELAY_BASE_MS = 500;

/**
 * Sentinel a provider returns from `parseText` when the reply was blocked by a
 * content filter (Gemini SAFETY/PROHIBITED_CONTENT). The driver fails the
 * batch immediately — like NoveLA's ContentBlockedException — instead of
 * retrying or falling back to the original text.
 */
export const CONTENT_BLOCKED = '__CONTENT_BLOCKED__';

/**
 * Thrown where the provider's content filter blocked the prompt. Treated as
 * fatal for the whole chapter (NoveLA behavior): no retry, no silent fallback
 * to the original text.
 */
export class ContentBlockedError extends Error {
  constructor() {
    super('Blocked by the provider content filter.');
    this.name = 'ContentBlockedError';
  }
}

const NUMBERED_LINE = /^\*{0,2}[№#]?\s*(\d+)\s*[.)]\*{0,2}\s*(.*)$/;
const BOLD_EDGE = /\*\*$/;

export interface ChatModelReply {
  parseText: (data: unknown) => string | undefined;
}

export interface ChatModelRequest {
  /** Build the request URL for the current API key (rotation-safe). */
  buildUrl: (apiKey: string) => string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (payload: string, systemPrompt: string | undefined) => unknown;
  reply: ChatModelReply;
}

/** NoveLA key lists: one per line, or comma/semicolon separated. */
export const parseApiKeys = (raw: string): string[] => {
  if (!raw) return [];
  return raw
    .split(/[\n;,]/)
    .map(key => key.trim())
    .filter(key => key.length > 0);
};

/** Chunk strictly by item count — the only guard NoveLA uses for chat models. */
const buildBatches = (texts: string[], batchSize: number): string[][] => {
  const size = Number.isFinite(batchSize) ? Math.floor(batchSize) : 0;
  const chunk = Math.max(1, Math.min(size || DEFAULT_BATCH_SIZE, texts.length));
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += chunk) {
    batches.push(texts.slice(i, i + chunk));
  }
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

  return originalTexts.map((text, index) => byIndex.get(index) ?? text);
};

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export interface TranslateChatOptions {
  /** NoveLA-style key list (one per line, or ,/; separated).
   * `apiKeys[0]` is also accepted via the legacy `apiKey` alias. */
  apiKeys: string[];
  errorCode: TranslationApiErrorCode;
  /** Max paragraphs per request. 0/blank → DEFAULT_BATCH_SIZE (60). */
  batchSize?: number;
}

/**
 * Round-robin key rotation mirroring NoveLA's translateBatch: each attempt
 * walks keys from a rotating start index; 429/401/403 advance to the next key
 * immediately, 5xx and 400 retry the current key with backoff.
 */
const postWithRotation = async (
  request: ChatModelRequest,
  payload: string,
  systemPrompt: string | undefined,
  options: TranslateChatOptions,
): Promise<string> => {
  const { apiKeys } = options;
  if (!apiKeys || apiKeys.length === 0) {
    throw new TranslationError('MISSING_KEY', 'No API key configured.');
  }

  // Round-robin: each batch starts from the next key in sequence.
  const start = keyIndex.getAndIncrement() % apiKeys.length;
  let lastError: unknown = null;

  for (let keyOffset = 0; keyOffset < apiKeys.length; keyOffset++) {
    const apiKey = apiKeys[(start + keyOffset) % apiKeys.length];
    for (let retry = 0; retry < RETRY_COUNT; retry++) {
      try {
        const response = await fetchTimeout(
          request.buildUrl(apiKey),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...request.buildHeaders(apiKey),
            },
            body: JSON.stringify(request.buildBody(payload, systemPrompt)),
          },
          REQUEST_TIMEOUT_MS,
        );

        if (
          response.status === 429 ||
          response.status === 401 ||
          response.status === 403
        ) {
          lastError = new TranslationError(
            options.errorCode,
            response.status === 429
              ? 'Rate limit exceeded.'
              : `Auth error (${response.status}).`,
          );
          break; // dead/rate-limited key — switch to the next one
        }
        if (response.status >= 500) {
          lastError = new TranslationError(
            options.errorCode,
            `Provider returned HTTP ${response.status}.`,
          );
          await delay(STATUS_500_DELAY_BASE_MS * (retry + 1));
          continue; // server hiccup — retry the same key
        }
        if (response.status === 400) {
          lastError = new TranslationError(
            options.errorCode,
            'Provider returned HTTP 400: bad request.',
          );
          await delay(STATUS_400_DELAY_BASE_MS * (retry + 1));
          continue;
        }
        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new TranslationError(
            options.errorCode,
            `Provider returned HTTP ${response.status}: ${body.slice(0, 200)}`,
          );
        }

        const data = await response.json().catch(() => null);
        const parsed = request.reply.parseText(data);
        if (parsed === CONTENT_BLOCKED) {
          throw new ContentBlockedError();
        }
        if (typeof parsed !== 'string' || parsed.trim() === '') {
          lastError = new TranslationError(
            options.errorCode,
            'Provider returned no text.',
          );
          await delay(EMPTY_REPLY_DELAY_BASE_MS * (retry + 1));
          continue;
        }
        return parsed;
      } catch (error) {
        if (error instanceof ContentBlockedError) throw error;
        lastError = error;
        await delay(EMPTY_REPLY_DELAY_BASE_MS * (retry + 1));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new TranslationError(options.errorCode, 'Provider request failed.');
};

export const translateChatTexts = async (
  request: ChatModelRequest,
  texts: string[],
  systemPrompt: string | undefined,
  options: TranslateChatOptions,
): Promise<string[]> => {
  const batches = buildBatches(texts, options.batchSize ?? 0);
  const results = [...texts];
  let succeeded = 0;
  let cursor = 0;
  let lastError: unknown = null;

  for (const batch of batches) {
    const start = cursor;
    cursor += batch.length;
    try {
      const reply = await postWithRotation(
        request,
        buildNumberedPayload(batch),
        systemPrompt,
        options,
      );
      const parsed = parseNumberedTranslations(reply, batch);
      for (let i = 0; i < batch.length; i++) {
        results[start + i] = parsed[i];
      }
      succeeded++;
    } catch (error) {
      // A content-filtered reply aborts the whole chapter (NoveLA).
      if (error instanceof ContentBlockedError) throw error;
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

// Round-robin counter shared across all calls, like NoveLA's AtomicInteger.
const keyIndex = (() => {
  let value = 0;
  return {
    getAndIncrement: () => value++,
  };
})();
