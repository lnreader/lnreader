/**
 * Free Google sample endpoint (translate.googleapis.com, `client=gtx`). No key
 * required; may throttle or break at any time.
 *
 * NoveLA-compatible behaviour: long paragraphs switch to a form POST, 429/5xx
 * are retried, and paragraphs are batched into 8000-char chunks sent with a
 * short delay to keep the public endpoint from rate-limiting. A single failed
 * chunk leaves those paragraphs untranslated instead of failing the chapter;
 * the chapter only errors out when every chunk fails.
 */

import { fetchTimeout } from '@utils/fetch/fetch';
import { TranslationError } from './types';

const GOOGLE_FREE_ENDPOINT =
  'https://translate.googleapis.com/translate_a/single';
const TIMEOUT_MS = 20000;
const MAX_CHUNK_CHARS = 8000;
const DELAY_BETWEEN_CHUNKS_MS = 1000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 800;
const POST_THRESHOLD_CHARS = 500;

const delay = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

const translateChunk = async (
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<string | undefined> => {
  let cookieSeeded = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const usePost = text.length > POST_THRESHOLD_CHARS;
      const response = usePost
        ? await fetchTimeout(
            GOOGLE_FREE_ENDPOINT,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams({
                client: 'gtx',
                sl: sourceLanguage,
                tl: targetLanguage,
                dt: 't',
                q: text,
              }).toString(),
            },
            TIMEOUT_MS,
          )
        : await fetchTimeout(
            `${GOOGLE_FREE_ENDPOINT}?${new URLSearchParams({
              client: 'gtx',
              sl: sourceLanguage,
              tl: targetLanguage,
              dt: 't',
              q: text,
            }).toString()}`,
            { headers: { 'User-Agent': 'LNReader/2' } },
            TIMEOUT_MS,
          );
      if (response.status === 429 && !cookieSeeded) {
        // NoveLA trick: seed JSESSIONID via translate.google.com so the
        // public endpoint stops rate-limiting us for a while.
        cookieSeeded = true;
        await fetchTimeout(
          'https://translate.google.com/?hl=en',
          { headers: { 'User-Agent': 'LNReader/2' } },
          TIMEOUT_MS,
        ).catch(() => undefined);
        attempt = Math.max(attempt - 1, -1);
        continue;
      }
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          if (attempt < MAX_RETRIES) {
            await delay(RETRY_DELAY_MS * (attempt + 1));
            continue;
          }
        }
        throw new TranslationError(
          'GOOGLE_FREE',
          `Google Free returned HTTP ${response.status}.`,
        );
      }
      const data = await response.json().catch(() => null);
      const segments: unknown[] = (data as any)?.[0] ?? [];
      const translated = segments
        .map(segment => (segment as any)?.[0])
        .filter((value): value is string => typeof value === 'string')
        .join('')
        .trim();
      if (!translated) {
        if (attempt < MAX_RETRIES) {
          await delay(RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        return undefined;
      }
      return translated;
    } catch {
      if (attempt < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      return undefined;
    }
  }
  return undefined;
};

const buildChunks = (
  texts: string[],
): { indices: number[]; text: string }[] => {
  const chunks: { indices: number[]; text: string }[] = [];
  let currentIndices: number[] = [];
  let currentParts: string[] = [];
  let currentLen = 0;
  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    if (currentLen > 0 && currentLen + text.length > MAX_CHUNK_CHARS) {
      chunks.push({ indices: currentIndices, text: currentParts.join('\n') });
      currentIndices = [];
      currentParts = [];
      currentLen = 0;
    }
    currentIndices.push(i);
    currentParts.push(text);
    currentLen += text.length + 1;
  }
  if (currentParts.length > 0) {
    chunks.push({ indices: currentIndices, text: currentParts.join('\n') });
  }
  return chunks;
};

export interface TranslateViaGoogleFreeOptions {
  sourceLanguage: string;
  targetLanguage: string;
}

export const translateViaGoogleFree = async (
  texts: string[],
  options: TranslateViaGoogleFreeOptions,
): Promise<string[]> => {
  const results = [...texts];
  const chunks = buildChunks(texts);
  let failedChunks = 0;

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await delay(DELAY_BETWEEN_CHUNKS_MS);
    const chunk = chunks[i];
    const translated = await translateChunk(
      chunk.text,
      options.sourceLanguage,
      options.targetLanguage,
    );
    if (translated == null) {
      failedChunks++;
      continue;
    }
    const translatedLines = translated
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    for (
      let j = 0;
      j < Math.min(translatedLines.length, chunk.indices.length);
      j++
    ) {
      results[chunk.indices[j]] = translatedLines[j];
    }
  }

  if (chunks.length > 0 && failedChunks === chunks.length) {
    throw new TranslationError(
      'GOOGLE_FREE',
      'Google Free failed to translate. Check your network connection.',
    );
  }
  return results;
};
