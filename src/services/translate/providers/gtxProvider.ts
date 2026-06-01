import { TranslationProvider } from '../types';

const MAX_CHARS_PER_BATCH = 4000;
const SEPARATOR = '\n\n||||\n\n';

/**
 * Free Google Translate (GTX) provider.
 * Uses the same GET endpoint as our existing translateText function.
 * No API key required.
 */
export const GtxProvider: TranslationProvider = {
  id: 'gtx',
  label: 'Google Translate (Free)',
  requiresKey: false,

  translateBatch: async (texts, targetLang) => {
    if (texts.length === 0) return [];

    const results: string[] = new Array(texts.length).fill('');
    const chunks = buildChunks(texts, MAX_CHARS_PER_BATCH);

    for (const chunk of chunks) {
      const combined = chunk.items.map(i => i.text).join(SEPARATOR);

      let translatedText: string | null = null;
      try {
        translatedText = await callGtx(combined, targetLang);
      } catch {}

      if (translatedText) {
        const parts = splitResponse(translatedText, chunk.items.length);
        if (parts) {
          for (let i = 0; i < chunk.items.length; i++) {
            results[chunk.items[i].index] = parts[i].trim();
          }
          continue;
        }
      }

      // Fallback: translate each item individually
      for (const item of chunk.items) {
        try {
          const single = await callGtx(item.text, targetLang);
          if (single) {
            results[item.index] = single.trim();
          }
        } catch {
          results[item.index] = item.text; // return original on failure
        }
      }
    }

    return results;
  },
};

async function callGtx(
  text: string,
  targetLang: string,
): Promise<string | null> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
    text,
  )}`;

  const res = await fetch(url, { method: 'GET' });

  if (!res.ok) {
    throw new Error(`GTX API error ${res.status}`);
  }

  const data = await res.json();
  if (!data || !data[0]) return null;

  let translated = '';
  for (let i = 0; i < data[0].length; i++) {
    if (data[0][i] && data[0][i][0]) {
      translated += data[0][i][0];
    }
  }

  return translated;
}

function splitResponse(result: string, expectedCount: number): string[] | null {
  const delimiters = [SEPARATOR, '\n\n||||\n\n', '\n||||\n', '||||'];
  for (const delim of delimiters) {
    const parts = result.split(delim);
    if (parts.length === expectedCount) return parts;
  }
  const partsRegex = result.split(/\s*\|\|\|\|\s*/);
  if (partsRegex.length === expectedCount) return partsRegex;
  return null;
}

interface ChunkItem {
  index: number;
  text: string;
}

function buildChunks(
  texts: string[],
  maxChars: number,
): { items: ChunkItem[] }[] {
  const chunks: { items: ChunkItem[] }[] = [];
  let current: ChunkItem[] = [];
  let currentLen = 0;

  for (let i = 0; i < texts.length; i++) {
    const itemLen = texts[i].length + SEPARATOR.length;
    if (currentLen + itemLen > maxChars && current.length > 0) {
      chunks.push({ items: current });
      current = [];
      currentLen = 0;
    }
    current.push({ index: i, text: texts[i] });
    currentLen += itemLen;
  }
  if (current.length > 0) {
    chunks.push({ items: current });
  }

  return chunks;
}
