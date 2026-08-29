/**
 * Google Cloud Translation (legacy v2) provider.
 *
 * The default key is the same *public* community key NoveLA ships for its
 * translators. It is shared across every NoveLA/LNReader install, is not a
 * secret, can be rate-limited or revoked at any time, and should never be
 * relied on in production; users can override it in settings.
 */

import { fetchTimeout } from '@utils/fetch/fetch';
import { TranslationError } from './types';

export const DEFAULT_GOOGLE_PA_COMMUNITY_KEY =
  'AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520';

export const GOOGLE_PA_ENDPOINT =
  'https://translation.googleapis.com/language/translate/v2';

const TIMEOUT_MS = 60000;

const MAX_Q_PER_REQUEST = 128;

export const resolveGooglePaApiKey = (options: {
  googlePaApiKey: string;
  useCommunityGooglePaKey: boolean;
}): string => {
  if (options.googlePaApiKey.trim()) return options.googlePaApiKey.trim();
  if (options.useCommunityGooglePaKey) return DEFAULT_GOOGLE_PA_COMMUNITY_KEY;
  return '';
};

export interface TranslateViaGooglePaOptions {
  apiKey: string;
  sourceLanguage: string;
  targetLanguage: string;
}

const translateChunk = async (
  chunk: string[],
  options: TranslateViaGooglePaOptions,
): Promise<string[]> => {
  const body: Record<string, unknown> = {
    q: chunk,
    target: options.targetLanguage,
    format: 'text',
  };
  if (options.sourceLanguage && options.sourceLanguage !== 'auto') {
    body.source = options.sourceLanguage;
  }
  const response = await fetchTimeout(
    `${GOOGLE_PA_ENDPOINT}?key=${encodeURIComponent(options.apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    TIMEOUT_MS,
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new TranslationError(
      'GOOGLE_PA',
      `Google PA returned HTTP ${response.status}: ${detail.slice(0, 200)}`,
    );
  }
  const data = await response.json().catch(() => null);
  const translations = (data as any)?.data?.translations ?? [];
  return translations.map(
    (entry: { translatedText?: string }) => entry?.translatedText ?? '',
  );
};

export const translateViaGooglePa = async (
  texts: string[],
  options: TranslateViaGooglePaOptions,
): Promise<string[]> => {
  if (!options.apiKey) {
    throw new TranslationError(
      'MISSING_KEY',
      'Google PA API key is not configured.',
    );
  }
  const results: string[] = [];
  for (let i = 0; i < texts.length; i += MAX_Q_PER_REQUEST) {
    results.push(
      ...(await translateChunk(texts.slice(i, i + MAX_Q_PER_REQUEST), options)),
    );
  }
  return results;
};
