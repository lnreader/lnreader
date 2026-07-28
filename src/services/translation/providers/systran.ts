/**
 * SYSTRAN Translate.
 *
 * Like Azure, a literal MT engine: it accepts an array of inputs and returns
 * an `outputs` array in the same order.
 */
import {
  TranslationError,
  type SystranConfig,
  type TranslationProvider,
} from '../types';
import { postJson, trimTrailingSlash } from './http';

export const DEFAULT_SYSTRAN_ENDPOINT = 'https://api-translate.systran.net';

interface SystranResponse {
  outputs?: { output?: string; error?: { message?: string } }[];
  error?: { message?: string };
}

export const systranProvider: TranslationProvider<SystranConfig> = {
  id: 'systran',
  isLocal: false,
  requiresApiKey: () => true,
  defaultConfig: {
    provider: 'systran',
    endpoint: DEFAULT_SYSTRAN_ENDPOINT,
  },
  translateBatch: async (texts, ctx) => {
    const { config, apiKey, sourceLang, targetLang, signal } = ctx;

    if (!apiKey) {
      throw new TranslationError('auth', 'A SYSTRAN API key is required.');
    }

    const body = await postJson<SystranResponse>(
      `${trimTrailingSlash(config.endpoint)}/translation/text/translate`,
      {
        input: texts,
        // SYSTRAN spells automatic detection "auto", so it passes straight
        // through rather than being omitted the way Azure needs.
        source: sourceLang || 'auto',
        target: targetLang,
        format: 'text',
      },
      { headers: { Authorization: `Key ${apiKey}` }, signal },
    );

    if (body.error?.message) {
      throw new TranslationError(
        'bad-response',
        `SYSTRAN error: ${body.error.message}`,
      );
    }

    const outputs = body.outputs;
    if (!Array.isArray(outputs) || outputs.length !== texts.length) {
      throw new TranslationError(
        'bad-response',
        `SYSTRAN returned ${
          Array.isArray(outputs)
            ? `${outputs.length} outputs`
            : 'an unexpected shape'
        } for ${texts.length} inputs.`,
      );
    }

    return outputs.map((entry, i) => {
      if (entry.error?.message) {
        throw new TranslationError(
          'bad-response',
          `SYSTRAN failed on segment ${i + 1}: ${entry.error.message}`,
        );
      }
      if (typeof entry.output !== 'string') {
        throw new TranslationError(
          'bad-response',
          `SYSTRAN returned no output for segment ${i + 1}.`,
        );
      }
      return entry.output;
    });
  },
};
