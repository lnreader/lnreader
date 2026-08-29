/**
 * OpenAI-compatible chat-completions translation provider. Endpoint, model and
 * key are all user-configurable so self-hosted LLM gateways work too.
 *
 * Base URLs follow NoveLA's convention: a bare host (or one ending in `/v1`)
 * is normalised to `{base}/v1/chat/completions`, so values like
 * `https://api.openai.com`, `https://api.openai.com/v1`,
 * `https://openrouter.ai/api` or a local Ollama host all resolve correctly.
 */

import { translateChatTexts, type ChatModelRequest } from './llm';

export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export const normalizeEndpoint = (endpoint: string): string => {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_OPENAI_ENDPOINT;
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  if (/\/v1$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
};

const buildOpenaiRequest = (
  endpoint: string,
  model: string,
  maxOutputTokens: number,
): ChatModelRequest => ({
  url: normalizeEndpoint(endpoint),
  buildHeaders: apiKey => ({
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }),
  buildBody: (payload, systemPrompt) => ({
    model,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      { role: 'user', content: payload },
    ],
    temperature: 0.2,
    top_p: 1.0,
    stream: false,
    ...(maxOutputTokens > 0 ? { max_tokens: maxOutputTokens } : {}),
  }),
  reply: {
    parseText: data =>
      (data as any)?.choices?.[0]?.message?.content || undefined,
  },
});

export interface TranslateViaOpenaiOptions {
  apiKey: string;
  endpoint?: string;
  model?: string;
  systemPrompt?: string;
  /** 0 (and negative caps) let the model decide; only sent when > 0. */
  maxOutputTokens?: number;
  errorCode: 'OPENAI';
}

export const translateViaOpenai = (
  texts: string[],
  options: TranslateViaOpenaiOptions,
): Promise<string[]> =>
  translateChatTexts(
    buildOpenaiRequest(
      options.endpoint?.trim() || DEFAULT_OPENAI_ENDPOINT,
      options.model?.trim() || DEFAULT_OPENAI_MODEL,
      Math.floor(options.maxOutputTokens ?? 0),
    ),
    texts,
    options.systemPrompt,
    { apiKey: options.apiKey, errorCode: options.errorCode },
  );