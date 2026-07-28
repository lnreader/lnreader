/**
 * Per-provider connectivity test (spec §6.4).
 *
 * Sends one trivial string through the configured provider so the user can
 * validate credentials and endpoint before trusting the setup on a real
 * chapter. Deliberately exercises the same `translateBatch` path as a real
 * translation — a test that used a different code path could pass while
 * translation still failed.
 */
import { getTranslationProvider } from './providers';
import { getApiKey } from './secureStorage';
import {
  TranslationError,
  type SourceLanguage,
  type TranslationConfig,
} from './types';

/** Short, unambiguous, and cheap to translate into any target language. */
export const TEST_PHRASE = 'Hello, world.';

export const TEST_TIMEOUT_MS = 20_000;

export type TestProviderResult =
  | { ok: true; translated: string }
  | { ok: false; kind: TranslationError['kind']; message: string };

export const testProvider = async (
  config: TranslationConfig,
  targetLang: string,
  sourceLang: SourceLanguage = 'auto',
): Promise<TestProviderResult> => {
  const provider = getTranslationProvider(config.provider);

  let apiKey: string | undefined;
  try {
    apiKey = await getApiKey(config.provider);
  } catch {
    return {
      ok: false,
      kind: 'config',
      message:
        'Secure storage is unavailable, so the API key could not be read.',
    };
  }

  if (provider.requiresApiKey(config) && !apiKey) {
    return {
      ok: false,
      kind: 'auth',
      message: 'No API key is configured for this provider.',
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TEST_TIMEOUT_MS);

  try {
    const [translated] = await provider.translateBatch([TEST_PHRASE], {
      config,
      apiKey,
      sourceLang,
      targetLang,
      signal: controller.signal,
    });

    if (!translated) {
      return {
        ok: false,
        kind: 'bad-response',
        message: 'The provider returned an empty translation.',
      };
    }
    return { ok: true, translated };
  } catch (error) {
    if (error instanceof TranslationError) {
      return { ok: false, kind: error.kind, message: error.message };
    }
    return {
      ok: false,
      kind: 'network',
      message: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
};
