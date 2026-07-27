/**
 * LibreTranslate — the free/no-key option (public instance) and, pointed at a
 * different endpoint, one of the self-hosted options.
 *
 * Chosen over the unofficial Google "GTX" endpoint for Phase 1 because that
 * endpoint's ToS status is still an open question in the spec (§8.1). This
 * provider is open-source and documented, so shipping it doesn't depend on
 * resolving that.
 */
import {
  TranslationError,
  type LibreTranslateConfig,
  type TranslationProvider,
} from '../types';
import { postJson, trimTrailingSlash } from './http';

/** A commonly-available public instance; users can point elsewhere. */
export const DEFAULT_LIBRETRANSLATE_ENDPOINT = 'https://libretranslate.com';

interface LibreTranslateResponse {
  translatedText?: string | string[];
}

export const libreTranslateProvider: TranslationProvider<LibreTranslateConfig> =
  {
    id: 'libretranslate',
    isLocal: false,
    requiresApiKey: config => config.requiresApiKey,
    defaultConfig: {
      provider: 'libretranslate',
      endpoint: DEFAULT_LIBRETRANSLATE_ENDPOINT,
      requiresApiKey: false,
    },
    translateBatch: async (texts, ctx) => {
      const { config, apiKey, sourceLang, targetLang, signal } = ctx;

      const body = await postJson<LibreTranslateResponse>(
        `${trimTrailingSlash(config.endpoint)}/translate`,
        {
          q: texts,
          source: sourceLang,
          target: targetLang,
          format: 'text',
          ...(apiKey ? { api_key: apiKey } : {}),
        },
        { signal },
      );

      const { translatedText } = body;

      // The API mirrors its input shape: an array in yields an array out, but
      // a single-element array can come back as a bare string.
      if (typeof translatedText === 'string' && texts.length === 1) {
        return [translatedText];
      }

      if (
        !Array.isArray(translatedText) ||
        translatedText.length !== texts.length
      ) {
        throw new TranslationError(
          'bad-response',
          `LibreTranslate returned ${
            Array.isArray(translatedText)
              ? `${translatedText.length} segments`
              : 'an unexpected shape'
          } for ${texts.length} inputs.`,
        );
      }

      return translatedText.map(String);
    },
  };
