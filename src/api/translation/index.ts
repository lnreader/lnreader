/**
 * Translation provider dispatcher. Callers resolve effective settings first
 * (see {@link @api/translation/settings}) and pass concrete credentials here.
 */

import type { TranslationProvider } from './types';
import { translateViaGoogleFree } from './googleFree';
import { translateViaGooglePa, resolveGooglePaApiKey } from './googlePa';
import { translateViaGemini } from './gemini';
import { translateViaOpenai } from './openai';

export interface TranslationRequestOptions {
  provider: TranslationProvider;
  texts: string[];
  sourceLanguage: string;
  targetLanguage: string;
  systemPrompt?: string;
  googlePaApiKey?: string;
  useCommunityGooglePaKey?: boolean;
  geminiApiKey?: string;
  geminiModel?: string;
  openaiApiKey?: string;
  openaiEndpoint?: string;
  openaiModel?: string;
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
    case 'GOOGLE_PA':
      return translateViaGooglePa(texts, {
        apiKey: resolveGooglePaApiKey({
          googlePaApiKey: options.googlePaApiKey ?? '',
          useCommunityGooglePaKey: options.useCommunityGooglePaKey ?? true,
        }),
        sourceLanguage: options.sourceLanguage,
        targetLanguage: options.targetLanguage,
      });
    case 'GEMINI':
      return translateViaGemini(texts, {
        apiKey: options.geminiApiKey ?? '',
        model: options.geminiModel,
        systemPrompt: options.systemPrompt,
        errorCode: 'GEMINI',
      });
    case 'OPENAI':
      return translateViaOpenai(texts, {
        apiKey: options.openaiApiKey ?? '',
        endpoint: options.openaiEndpoint,
        model: options.openaiModel,
        systemPrompt: options.systemPrompt,
        errorCode: 'OPENAI',
      });
  }
};
