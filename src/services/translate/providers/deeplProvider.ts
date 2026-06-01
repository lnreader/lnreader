import { TranslationProvider } from '../types';

const URLS = {
  free: 'https://api-free.deepl.com/v2/translate',
  pro: 'https://api.deepl.com/v2/translate',
};
const MAX_CHARS_PER_BATCH = 100_000;

/**
 * DeepL translation provider.
 * Requires an API key. Supports free and pro plans (different base URLs).
 * Pass { plan: 'free' | 'pro' } in the extra param.
 */
export const DeepLProvider: TranslationProvider = {
  id: 'deepl',
  label: 'DeepL',
  requiresKey: true,

  translateBatch: async (texts, targetLang, apiKey, extra) => {
    if (!apiKey) throw new Error('DeepL API key not configured');
    if (texts.length === 0) return [];

    const plan = (extra?.plan as 'free' | 'pro') ?? 'free';
    const url = URLS[plan];

    const batches = buildBatches(texts, MAX_CHARS_PER_BATCH);
    const results = await Promise.all(
      batches.map(b => callDeepL(b, targetLang, apiKey, url)),
    );
    return results.flat();
  },
};

async function callDeepL(
  texts: string[],
  targetLang: string,
  apiKey: string,
  baseUrl: string,
): Promise<string[]> {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: JSON.stringify({
      text: texts,
      target_lang: targetLang.toUpperCase(), // DeepL requires uppercase: 'EN', 'JA', 'AR'
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `DeepL error ${res.status}`);
  }
  const data = await res.json();
  const translations = data?.translations;
  if (!Array.isArray(translations)) {
    return texts;
  }
  return translations.map((t: any, idx: number) => t?.text ?? texts[idx] ?? '');
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
