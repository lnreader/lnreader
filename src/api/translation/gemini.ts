/**
 * Gemini translation provider (generativelanguage.googleapis.com). The REST
 * `:generateContent` endpoint takes the formatted prompt as a system
 * instruction and the numbered paragraph batch as the only user message.
 *
 * Matches NoveLA's hardened request shape: BLOCK_NONE safety settings for all
 * categories, plain-text responses, tools disabled, low temperature and the
 * key sent both in the URL and the `X-Goog-API-Key` header. Content-filtered
 * replies parse to `undefined` so the driver falls back to the original text.
 */

import { translateChatTexts, type ChatModelRequest } from './llm';

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
  apiKey: string,
  maxOutputTokens: number,
): ChatModelRequest => ({
  url: `${GEMINI_ENDPOINT}/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`,
  buildHeaders: () => ({
    'Content-Type': 'application/json',
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
      if (response?.promptFeedback?.blockReason) return undefined;
      const candidate = response?.candidates?.[0];
      if (!candidate) return undefined;
      if (
        candidate.finishReason &&
        BLOCKED_FINISH_REASONS.includes(candidate.finishReason)
      ) {
        return undefined;
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
  apiKey: string;
  model?: string;
  systemPrompt?: string;
  /** 0 (and negative caps) let the model decide; only sent when > 0. */
  maxOutputTokens?: number;
  errorCode: 'GEMINI';
}

export const translateViaGemini = (
  texts: string[],
  options: TranslateViaGeminiOptions,
): Promise<string[]> =>
  translateChatTexts(
    buildGeminiRequest(
      options.model?.trim() || DEFAULT_GEMINI_MODEL,
      options.apiKey,
      Math.floor(options.maxOutputTokens ?? 0),
    ),
    texts,
    options.systemPrompt,
    { apiKey: options.apiKey, errorCode: options.errorCode },
  );