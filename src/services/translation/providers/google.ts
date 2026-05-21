import { TranslationProvider } from '../types';

const BASE_URL = 'https://translation.googleapis.com/language/translate/v2';
const MAX_CHARS_PER_BATCH = 4500;

export const GoogleProvider: TranslationProvider = {
  id: 'google',
  label: 'Google Cloud Translate',
  requiresKey: true,

  translateBatch: async (texts, targetLang, config) => {
    const key = config.googleApiKey;
    if (!key) throw new Error('Google API key not configured');

    const batches = buildBatches(texts, MAX_CHARS_PER_BATCH);
    const results = await Promise.all(
      batches.map(b => callGoogle(b, targetLang, key)),
    );
    return results.flat();
  },
};

async function callGoogle(texts: string[], targetLang: string, apiKey: string) {
  const res = await fetch(`${BASE_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: texts, target: targetLang, format: 'text' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Google API error ${res.status}`);
  }
  const data = await res.json();
  return data.data.translations.map((t: any) => t.translatedText as string);
}

function buildBatches(texts: string[], maxChars: number): string[][] {
  const batches: string[][] = [];
  let current: string[] = [],
    count = 0;
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
