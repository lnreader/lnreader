import { TranslationProvider } from '../types';

interface ParagraphItem {
  index: number;
  text: string;
}

// Chunks the paragraphs so that no single request exceeds a soft limit of characters.
// We use a safe soft limit of 5000 characters per request.
function chunkParagraphs(texts: string[], maxChars: number): ParagraphItem[][] {
  const chunks: ParagraphItem[][] = [];
  let currentChunk: ParagraphItem[] = [];
  let currentLength = 0;

  for (let i = 0; i < texts.length; i++) {
    const text = texts[i];
    // Estimate formatted size: "[index]\ntext\n\n"
    const estimatedLen = text.length + String(i).length + 5;

    if (currentLength + estimatedLen > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }

    currentChunk.push({ index: i, text });
    currentLength += estimatedLen;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Submits a POST request to Google's free Translate API using form-urlencoded formatting.
async function callGoogleFreePost(text: string, targetLang: string): Promise<string | null> {
  const url = 'https://translate.googleapis.com/translate_a/single';
  
  const body = new URLSearchParams();
  body.append('client', 'gtx');
  body.append('sl', 'auto');
  body.append('tl', targetLang);
  body.append('dt', 't');
  body.append('q', text);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Google API POST error ${res.status}`);
  }

  const data = await res.json();
  if (!data || !data[0]) {
    return null;
  }

  // Combine translated chunks from Google's deeply nested array response
  const translated = data[0]
    .map((chunk: any[]) => chunk[0])
    .filter(Boolean)
    .join('');

  return translated;
}

// Fallback function: translates a single paragraph with retry logic and linear backoff
async function translateSingleWithRetry(
  text: string,
  targetLang: string,
  retries = 2,
): Promise<string> {
  let lastError: any = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await callGoogleFreePost(text, targetLang);
      if (result) return result;
    } catch (err) {
      lastError = err;
    }
    // Delay with linear backoff (300ms, 600ms...)
    await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)));
  }
  // eslint-disable-next-line no-console
  console.warn(`[GtxProvider] Single paragraph translation failed, returning original text.`, lastError);
  return text;
}

// Main translator chunk function
async function translateChunk(
  chunk: ParagraphItem[],
  targetLang: string,
): Promise<Record<number, string>> {
  // Wrap paragraphs with markers
  const wrappedText = chunk
    .map(item => `[${item.index}]\n${item.text}`)
    .join('\n\n');

  const translatedText = await callGoogleFreePost(wrappedText, targetLang);
  if (!translatedText) {
    throw new Error('Google Translate returned empty response');
  }

  const results: Record<number, string> = {};
  // Regex to extract text grouped under [index] markers.
  // Uses positive lookahead to safely handle multiline and avoid greedy match issues.
  const markerRegex = /\[\s*(\d+)\s*\]\s*\n?([\s\S]*?)(?=\[\s*\d+\s*\]|$)/g;
  
  let match;
  while ((match = markerRegex.exec(translatedText)) !== null) {
    const index = parseInt(match[1], 10);
    const text = match[2].trim();
    if (!isNaN(index)) {
      results[index] = text;
    }
  }

  return results;
}

export const GtxProvider: TranslationProvider = {
  id: 'gtx',
  label: 'Google Translate (Free)',
  requiresKey: false,

  translateBatch: async (texts, targetLang, _config, _apiKey) => {
    if (texts.length === 0) return [];

    const results: string[] = new Array(texts.length);
    const chunks = chunkParagraphs(texts, 5000);

    for (const chunk of chunks) {
      let chunkResults: Record<number, string> = {};
      let success = false;

      try {
        chunkResults = await translateChunk(chunk, targetLang);
        success = Object.keys(chunkResults).length > 0;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[GtxProvider] Batch chunk translation failed, falling back to single translation.`, err);
      }

      for (const item of chunk) {
        const translated = chunkResults[item.index];
        if (success && translated !== undefined && translated.trim().length > 0) {
          results[item.index] = translated;
        } else {
          // Fallback to translating this single paragraph individually
          results[item.index] = await translateSingleWithRetry(item.text, targetLang);
        }
      }

      // Small delay between chunks to avoid rate limiting
      await new Promise(r => setTimeout(r, 100));
    }

    return results;
  },
};
