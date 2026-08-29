/**
 * OpenAI-compatible chat-completions translation provider. Endpoint, model and
 * key are all user-configurable so self-hosted LLM gateways work too.
 */

import { translateChatTexts, type ChatModelRequest } from './llm';

export const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1';
export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const normalizeEndpoint = (endpoint: string): string => {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(trimmed)) return trimmed;
  return `${trimmed}/chat/completions`;
};

const buildOpenaiRequest = (
  endpoint: string,
  model: string,
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
    temperature: 0.4,
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
    ),
    texts,
    options.systemPrompt,
    { apiKey: options.apiKey, errorCode: options.errorCode },
  );
