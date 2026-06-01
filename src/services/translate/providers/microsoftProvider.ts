import { TranslationProvider } from '../types';

const GLOBAL_ENDPOINT = 'https://api.cognitive.microsofttranslator.com';
const MAX_CHARS_PER_BATCH = 48_000;

/**
 * Microsoft Azure Translator provider.
 * Requires an API key. Optionally requires a region for regional resources.
 * Pass { region: 'eastus' } in the extra param if needed.
 */
export const MicrosoftProvider: TranslationProvider = {
  id: 'microsoft',
  label: 'Microsoft Azure Translator',
  requiresKey: true,

  translateBatch: async (texts, targetLang, apiKey, extra) => {
    if (!apiKey) throw new Error('Microsoft API key not configured');
    if (texts.length === 0) return [];

    const region = extra?.region;
    const batches = buildBatches(texts, MAX_CHARS_PER_BATCH);
    const results = await Promise.all(
      batches.map(b => callMicrosoft(b, targetLang, apiKey, region)),
    );
    return results.flat();
  },
};

async function callMicrosoft(
  texts: string[],
  targetLang: string,
  apiKey: string,
  region?: string,
): Promise<string[]> {
  const url = `${GLOBAL_ENDPOINT}/translate?api-version=3.0&to=${targetLang}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Ocp-Apim-Subscription-Key': apiKey,
  };
  // Region header required for regional/multi-service resources, optional for global
  if (region) headers['Ocp-Apim-Subscription-Region'] = region;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    // Microsoft wraps each string in an object: [{ Text: '...' }, ...]
    body: JSON.stringify(texts.map(t => ({ Text: t }))),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err?.error?.message ?? `Microsoft Translator error ${res.status}`,
    );
  }
  const data: Array<{ translations: Array<{ text: string }> }> =
    await res.json();
  return data.map(r => r.translations[0].text);
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
