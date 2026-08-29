/**
 * Shared driver for raw-text chat-model providers (Gemini, OpenAI-compatible).
 *
 * Sends batches of paragraphs as a JSON array and expects a JSON array back.
 * When a model returns something that cannot be parsed, batch 1 is retried one
 * paragraph at a time, taking each (de-quoted) raw reply as its translation.
 */

import { fetchTimeout } from '@utils/fetch/fetch';
import { TranslationError, type TranslationApiErrorCode } from './types';

const MAX_BATCH_SIZE = 8;
const MAX_BATCH_CHARS = 8000;
const REQUEST_TIMEOUT_MS = 60000;

const FENCED_JSON = /```(?:json)?\s*([\s\S]*?)```/;

const parseJsonReply = (raw: string): unknown => {
  const fenced = raw.match(FENCED_JSON);
  const candidate = fenced?.[1] ?? raw;
  try {
    return JSON.parse(candidate);
  } catch {
    // fall through to array extraction
  }
  const start = candidate.indexOf('[');
  const end = candidate.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
  return undefined;
};

const parseStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const strings = value.map(item =>
    typeof item === 'string' ? item : String(item ?? ''),
  );
  return strings;
};

const cleanSingle = (raw: string): string => {
  const trimmed = raw.trim();
  const parsed = parseJsonReply(trimmed);
  if (typeof parsed === 'string') {
    return parsed;
  }
  if (Array.isArray(parsed)) {
    return parseStringArray(parsed)?.join(' ') ?? trimmed;
  }
  return trimmed;
};

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
      throw new TranslationError(
        options.errorCode,
        `Provider returned HTTP ${response.status}: ${body.slice(0, 200)}`,
      );
    }
    const data = await response.json().catch(() => null);
    return request.reply.parseText(data);
  };

  const results: string[] = [];
  for (const batch of buildBatches(texts)) {
    const batchPayload = JSON.stringify(batch);
    const reply = await post(batchPayload);
    if (!reply) {
      throw new TranslationError(
        options.errorCode,
        'Provider returned no text.',
      );
    }
    const parsed = parseStringArray(parseJsonReply(reply));
    if (parsed && parsed.length === batch.length) {
      results.push(...parsed);
      continue;
    }
    // Fall back to one request per paragraph, treating the reply as the raw
    // translation (and de-quoting it when the model wrapped it in JSON).
    for (const item of batch) {
      const itemReply = await post(JSON.stringify(item));
      results.push(cleanSingle(itemReply ?? ''));
    }
  }
  return results;
};
