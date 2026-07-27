/**
 * Google Gemini — the bring-your-own-key cloud option for Phase 1.
 *
 * Chosen over DeepL for the MVP because its free tier needs no billing
 * account, which matters for the "free-tier API key" row of spec §6.4.
 */
import {
  TranslationError,
  type GeminiConfig,
  type TranslationProvider,
} from '../types';
import { postJson } from './http';
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT_TEMPLATE,
  encodeBatch,
  parseJsonArrayResponse,
  fillPromptTemplate,
} from './llm';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

interface GeminiResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] };
    finishReason?: string;
  }[];
}

export const geminiProvider: TranslationProvider<GeminiConfig> = {
  id: 'gemini',
  isLocal: false,
  requiresApiKey: () => true,
  defaultConfig: {
    provider: 'gemini',
    model: DEFAULT_GEMINI_MODEL,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    userPromptTemplate: DEFAULT_USER_PROMPT_TEMPLATE,
  },
  translateBatch: async (texts, ctx) => {
    const { config, apiKey, sourceLang, targetLang, signal } = ctx;

    if (!apiKey) {
      throw new TranslationError('auth', 'A Gemini API key is required.');
    }

    const prompt = fillPromptTemplate(config.userPromptTemplate, {
      sourceLang,
      targetLang,
      text: encodeBatch(texts),
    });

    const body = await postJson<GeminiResponse>(
      `${API_BASE}/${encodeURIComponent(config.model)}:generateContent`,
      {
        systemInstruction: { parts: [{ text: config.systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        // Constrains decoding to JSON so the fence-stripping in `llm.ts` is a
        // fallback rather than the primary path.
        generationConfig: { responseMimeType: 'application/json' },
      },
      // Header auth rather than a query string, so the key can't leak into
      // request logs via the URL.
      { headers: { 'x-goog-api-key': apiKey }, signal },
    );

    const candidate = body.candidates?.[0];
    const text = candidate?.content?.parts
      ?.map(part => part.text ?? '')
      .join('');

    if (!text) {
      throw new TranslationError(
        'bad-response',
        candidate?.finishReason
          ? `Gemini returned no content (finish reason: ${candidate.finishReason}).`
          : 'Gemini returned no content.',
      );
    }

    return parseJsonArrayResponse(text, texts.length, 'Gemini');
  },
};
