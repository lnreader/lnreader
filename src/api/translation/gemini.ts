/**
 * Gemini translation provider (generativelanguage.googleapis.com). The REST
 * `:generateContent` endpoint takes the formatted prompt as a system
 * instruction and the numbered paragraph batch as the only user message.
 *
 * Matches NoveLA's hardened request shape: BLOCK_NONE safety settings for all
 * categories (including CIVIC_INTEGRITY), plain-text responses, tools
 * disabled, low temperature, `maxOutputTokens` only sent when set (0 = let the
 * model decide) and the key passed in the URL and `X-Goog-API-Key` header.
 * Multiple keys are rotated by the shared driver. Content-filtered replies
 * abort the batch with a clear error (NoveLA's ContentBlockedException), not a
 * silent fallback to the original text.
 */

import {
  CONTENT_BLOCKED,
  translateChatTexts,
  type ChatModelRequest,
} from './llm';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

const SAFETY_CATEGORIES = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
  'HARM_CATEGORY_CIVIC_INTEGRITY',
] as const;

const BLOCKED_FINISH_REASONS = ['SAFETY', 'PROHIBITED_CONTENT'];

const buildGeminiRequest = (
  model: string,
  maxOutputTokens: number,
): ChatModelRequest => ({
  buildUrl: apiKey =>
    `${GEMINI_ENDPOINT}/${encodeURIComponent(
      model,
    )}:generateContent?key=${encodeURIComponent(apiKey)}`,
  buildHeaders: apiKey => ({
    'X-Goog-API-Key': apiKey,
  }),
  buildBody: (payload, systemPrompt) => ({
    systemInstruction: systemPrompt
      ? { parts: [{ text: systemPrompt }] }
      : undefined,
    contents: [{ role: 'user', parts: [{ text: payload }] }],
    generationConfig: {
      temperature: 0.15,
      topP: 0.9,
      responseMimeType: 'text/plain',
      ...(maxOutputTokens > 0 ? { maxOutputTokens } : {}),
    },
    safetySettings: SAFETY_CATEGORIES.map(category => ({
      category,
      threshold: 'BLOCK_NONE',
    })),
    tools: [],
  }),
  reply: {
    parseText: data => {
      const response = data as {
        promptFeedback?: { blockReason?: string };
        candidates?: {
          finishReason?: string;
          content?: { parts?: { text?: string }[] };
        }[];
      };
      if (response?.promptFeedback?.blockReason) return CONTENT_BLOCKED;
      const candidate = response?.candidates?.[0];
      if (!candidate) return undefined;
      if (
        candidate.finishReason &&
        BLOCKED_FINISH_REASONS.includes(candidate.finishReason)
      ) {
        return CONTENT_BLOCKED;
      }
      return (
        candidate.content?.parts
          ?.map(part => part?.text)
          .filter(Boolean)
          .join('') || undefined
      );
    },
  },
});

export interface TranslateViaGeminiOptions {
  /** NoveLA-style key list (one per line, or ,/; separated). */
  apiKeys: string[];
  model?: string;
  systemPrompt?: string;
  /** 0 (and negative caps) let the model decide; only sent when > 0. */
  maxOutputTokens?: number;
  /** Max paragraphs per request (NoveLA TRANSLATION_BATCH_SIZE). */
  batchSize?: number;
  errorCode: 'GEMINI';
}

export const translateViaGemini = (
  texts: string[],
  options: TranslateViaGeminiOptions,
): Promise<string[]> =>
  translateChatTexts(
    buildGeminiRequest(
      options.model?.trim() || DEFAULT_GEMINI_MODEL,
      Math.floor(options.maxOutputTokens ?? 0),
    ),
    texts,
    options.systemPrompt,
    {
      apiKeys: options.apiKeys,
      errorCode: options.errorCode,
      batchSize: options.batchSize,
    },
  );
