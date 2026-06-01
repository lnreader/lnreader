import { TranslationProvider } from '../types';

const BASE_URL = 'https://translation.googleapis.com/language/translate/v2';
const MAX_CHARS_PER_BATCH = 4500;

/**
 * Google Cloud Translation API v2 provider.
 * Requires an API key from Google Cloud Console.
 * Supports batch translation via JSON body.
 */
export const GoogleProvider: TranslationProvider = {
  id: 'google',
  label: 'Google Cloud Translate',
  requiresKey: true,

  translateBatch: async (texts, targetLang, apiKey) => {
    if (!apiKey) throw new Error('Google Cloud API key not configured');
    if (texts.length === 0) return [];

    const batches = buildBatches(texts, MAX_CHARS_PER_BATCH);
    const results = await Promise.all(
      batches.map(b => callGoogle(b, targetLang, apiKey)),
    );
    return results.flat();
  },
};

async function callGoogle(
  texts: string[],
  targetLang: string,
  apiKey: string,
): Promise<string[]> {
  const res = await fetch(`${BASE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target: targetLang, format: 'text' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ?? `Google Cloud API error ${res.status}`,
    );
  }
  const data = await res.json();
  return data.data.translations.map((t: any) => t.translatedText as string);
}

function buildBatches(texts: string[], maxChars: number): string[][] {
  const batches: string[][] = [];
  let current: string[] = [];
  let count = 0;
  for (const t of texts) {
    if (count + t.length > maxChars && current.length) {
      batches.push(current);
      current = [];
      count = 0;
    }
    current.push(t);
    count += t.length;
  }
  if (current.length) batches.push(current);
  return batches;
}
