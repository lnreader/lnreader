import { TranslationProvider } from '../types';

const URLS = {
  free: 'https://api-free.deepl.com/v2/translate',
  pro: 'https://api.deepl.com/v2/translate',
};
const MAX_CHARS_PER_BATCH = 100_000;

export const DeepLProvider: TranslationProvider = {
  id: 'deepl',
  label: 'DeepL',
  requiresKey: true,

  translateBatch: async (texts, targetLang, config, apiKey) => {
    if (!apiKey) throw new Error('DeepL API key not configured');
    const plan = config.provider === 'deepl' ? config.plan : 'free';
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
) {
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `DeepL-Auth-Key ${apiKey}`,
    },
    body: JSON.stringify({
      text: texts,
      target_lang: targetLang.toUpperCase(), // DeepL requires 'EN', 'JA', etc.
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.message ?? `DeepL error ${res.status}`);
  }
  const data = await res.json();
  return data.translations.map((t: any) => t.text as string);
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
