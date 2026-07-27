/**
 * Ollama — the local/self-hosted option for Phase 1.
 *
 * Satisfies user story #4 (run your own model, pay nothing per request) and
 * the spec's non-goal of bundling an offline model: offline translation is
 * supported by pointing at the user's own server, not by shipping weights.
 */
import {
  TranslationError,
  type OllamaConfig,
  type TranslationProvider,
} from '../types';
import { postJson, trimTrailingSlash } from './http';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT_TEMPLATE,
  encodeBatch,
  parseJsonArrayResponse,
  fillPromptTemplate,
} from './llm';

/** Ollama's default bind address; almost always overridden by the user. */
export const DEFAULT_OLLAMA_ENDPOINT = 'http://127.0.0.1:11434';
export const DEFAULT_OLLAMA_MODEL = 'llama3.1';

interface OllamaChatResponse {
  message?: { content?: string };
  error?: string;
}

export const ollamaProvider: TranslationProvider<OllamaConfig> = {
  id: 'ollama',
  isLocal: true,
  // Ollama is unauthenticated by default. A key is still accepted and sent as
  // a bearer token, since users commonly put it behind a reverse proxy.
  requiresApiKey: () => false,
  defaultConfig: {
    provider: 'ollama',
    endpoint: DEFAULT_OLLAMA_ENDPOINT,
    model: DEFAULT_OLLAMA_MODEL,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
  },
  translateBatch: async (texts, ctx) => {
    const { config, apiKey, sourceLang, targetLang, signal } = ctx;

    const prompt = fillPromptTemplate(config.userPromptTemplate, {
      sourceLang,
      targetLang,
      text: encodeBatch(texts),
    });

    const body = await postJson<OllamaChatResponse>(
      `${trimTrailingSlash(config.endpoint)}/api/chat`,
      {
        model: config.model,
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: prompt },
        ],
        format: 'json',
        stream: false,
      },
      {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        signal,
      },
    );

    if (body.error) {
      throw new TranslationError('bad-response', `Ollama error: ${body.error}`);
    }

    const content = body.message?.content;
    if (!content) {
      throw new TranslationError('bad-response', 'Ollama returned no content.');
    }

    return parseJsonArrayResponse(content, texts.length, 'Ollama');
  },
};
