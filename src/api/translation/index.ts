/**
 * Translation provider dispatcher. Callers resolve effective settings first
 * (see {@link @api/translation/settings}) and pass concrete credentials here.
 * Chat providers take NoveLA-style key lists (split offline via
 * {@link @api/translation/llm#parseApiKeys}).
 */

import type { TranslationProvider } from './types';
import { translateViaGoogleFree } from './googleFree';
import { translateViaGooglePa, resolveGooglePaApiKeys } from './googlePa';
import { translateViaGemini } from './gemini';
import { translateViaOpenai } from './openai';
import { parseApiKeys } from './llm';

export interface TranslationRequestOptions {
  provider: TranslationProvider;
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt?: string;
  /** NoveLA-style PA key list ('' = use legacy key / community key). */
  googlePaApiKeys?: string;
  googlePaCachedKey?: string;
  googlePaKeyLastChecked?: number;
  persistGooglePaKeyCache?: (cachedKey: string, lastChecked: number) => void;
  persistGooglePaApiKeys?: (keys: string[]) => void;
  googlePaApiKey?: string;
  useCommunityGooglePaKey?: boolean;
  /** Gemini/OpenAI key list (one per line, or ,/; separated). */
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiEndpoint?: string;
  openaiModel?: string;
  /** Max paragraphs per chat-provider request (0 = NoveLA default 60). */
  batchSize?: number;
  /** Max output tokens for chat providers (0 = let the model decide). */
  maxOutputTokens?: number;
}

export const translateParagraphs = async (
  options: TranslationRequestOptions,
): Promise<string[]> => {
  const { provider, texts } = options;
  switch (provider) {
    case 'GOOGLE_FREE':
      return translateViaGoogleFree(texts, {
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      });
    case 'GOOGLE_PA': {
      const apiKeys = resolveGooglePaApiKeys({
        googlePaApiKeys: options.googlePaApiKeys ?? '',
        googlePaApiKey: options.googlePaApiKey ?? '',
        useCommunityGooglePaKey: options.useCommunityGooglePaKey ?? true,
      });
      return translateViaGooglePa(texts, {
        apiKeys,
        cachedKey: options.googlePaCachedKey ?? '',
        keyLastChecked: options.googlePaKeyLastChecked ?? 0,
        persistKeyCache: options.persistGooglePaKeyCache,
        persistApiKeys: options.persistGooglePaApiKeys,
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      });
    }
    case 'GEMINI':
      return translateViaGemini(texts, {
        apiKeys: parseApiKeys(options.geminiApiKey ?? ''),
        model: options.geminiModel,
        systemPrompt: options.systemPrompt,
        maxOutputTokens: options.maxOutputTokens,
        batchSize: options.batchSize,
        errorCode: 'GEMINI',
      });
    case 'OPENAI':
      return translateViaOpenai(texts, {
        apiKeys: parseApiKeys(options.openaiApiKey ?? ''),
        endpoint: options.openaiEndpoint,
        model: options.openaiModel,
        systemPrompt: options.systemPrompt,
        maxOutputTokens: options.maxOutputTokens,
        batchSize: options.batchSize,
        errorCode: 'OPENAI',
      });
  }
};
