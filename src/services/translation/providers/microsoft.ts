/**
 * Azure AI Translator (Microsoft).
 *
 * A literal MT engine rather than an LLM, so it takes no prompts and returns
 * one translation per input object — no JSON-array coaxing required.
 */
import {
  TranslationError,
  type MicrosoftConfig,
  type TranslationProvider,
} from '../types';
import { postJson, trimTrailingSlash } from './http';

export const DEFAULT_MICROSOFT_ENDPOINT =
  'https://api.cognitive.microsofttranslator.com';

interface MicrosoftTranslation {
  translations?: { text?: string }[];
}

export const microsoftProvider: TranslationProvider<MicrosoftConfig> = {
  id: 'microsoft',
  isLocal: false,
  requiresApiKey: () => true,
  defaultConfig: {
    provider: 'microsoft',
    endpoint: DEFAULT_MICROSOFT_ENDPOINT,
    region: '',
  },
  translateBatch: async (texts, ctx) => {
    const { config, apiKey, sourceLang, targetLang, signal } = ctx;

    if (!apiKey) {
      throw new TranslationError(
        'auth',
        'An Azure Translator subscription key is required.',
      );
    }

    const params = new URLSearchParams({
      'api-version': '3.0',
      'to': targetLang,
      'textType': 'plain',
    });
    // Omitting `from` is what enables Azure's own language detection; sending
    // the literal string "auto" would be rejected as an unknown language.
    if (sourceLang && sourceLang !== 'auto') {
      params.set('from', sourceLang);
    }

    const body = await postJson<MicrosoftTranslation[]>(
      `${trimTrailingSlash(config.endpoint)}/translate?${params.toString()}`,
      texts.map(text => ({ Text: text })),
      {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey,
          // Required for regional resources, must be absent for global ones.
          ...(config.region
            ? { 'Ocp-Apim-Subscription-Region': config.region }
            : {}),
        },
        signal,
      },
    );

    if (!Array.isArray(body) || body.length !== texts.length) {
      throw new TranslationError(
        'bad-response',
        `Azure Translator returned ${
          Array.isArray(body) ? `${body.length} results` : 'an unexpected shape'
        } for ${texts.length} inputs.`,
      );
    }

    return body.map((entry, i) => {
      const text = entry.translations?.[0]?.text;
      if (typeof text !== 'string') {
        throw new TranslationError(
          'bad-response',
          `Azure Translator returned no translation for segment ${i + 1}.`,
        );
      }
      return text;
    });
  },
};
