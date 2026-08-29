/**
 * Gemini translation provider (generativelanguage.googleapis.com). The REST
 * `:generateContent` endpoint takes the formatted prompt as a system
 * instruction and the paragraph batch as the only user message.
 */

import { translateChatTexts, type ChatModelRequest } from './llm';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models';

const buildGeminiRequest = (
  model: string,
  apiKey: string,
): ChatModelRequest => ({
  url: `${GEMINI_ENDPOINT}/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`,
  buildHeaders: () => ({ 'Content-Type': 'application/json' }),
  buildBody: (payload, systemPrompt) => ({
    systemInstruction: systemPrompt
      ? { parts: [{ text: systemPrompt }] }
      : undefined,
    contents: [{ role: 'user', parts: [{ text: payload }] }],
    generationConfig: { temperature: 0.4, topP: 0.95 },
  }),
  reply: {
    parseText: data =>
      (data as any)?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text)
        .filter(Boolean)
        .join('') || undefined,
  },
});

export interface TranslateViaGeminiOptions {
  apiKey: string;
  model?: string;
  systemPrompt?: string;
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
    ),
    texts,
    options.systemPrompt,
    { apiKey: options.apiKey, errorCode: options.errorCode },
  );
