/**
 * Free Google sample endpoint (translate.googleapis.com, `client=gtx`). No key
 * required; may throttle or break at any time.
 */

import { fetchTimeout } from '@utils/fetch/fetch';
import { TranslationError } from './types';

const GOOGLE_FREE_ENDPOINT =
  'https://translate.googleapis.com/translate_a/single';
const TIMEOUT_MS = 20000;

export interface TranslateViaGoogleFreeOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export const translateViaGoogleFree = async (
  texts: string[],
  options: TranslateViaGoogleFreeOptions,
): Promise<string[]> => {
  const results: string[] = [];
  for (const text of texts) {
    const params = new URLSearchParams({
      client: 'gtx',
      sl: options.sourceLanguage,
      tl: options.targetLanguage,
      dt: 't',
      q: text,
    });
    const response = await fetchTimeout(
      `${GOOGLE_FREE_ENDPOINT}?${params.toString()}`,
      { headers: { 'User-Agent': 'LNReader/2' } },
      TIMEOUT_MS,
    );
    if (!response.ok) {
      throw new TranslationError(
        'GOOGLE_FREE',
        `Google Free returned HTTP ${response.status}.`,
      );
    }
    const data = await response.json().catch(() => null);
    const segments: unknown[] = (data as any)?.[0] ?? [];
    results.push(
      segments
        .map(segment => (segment as any)?.[0])
        .filter((value): value is string => typeof value === 'string')
        .join(''),
    );
  }
  return results;
};
