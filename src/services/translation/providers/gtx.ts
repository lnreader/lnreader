import { TranslationProvider } from '../types';

export const GtxProvider: TranslationProvider = {
  id: 'gtx',
  label: 'Google Translate (Free)',
  requiresKey: false,

  translateBatch: async (texts, targetLang) => {
    const results: string[] = [];
    for (const text of texts) {
      const url =
        `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(
          text,
        )}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`GTX error ${res.status}`);
      const data = await res.json();
      // Response is a deeply nested array: [[['translated', 'original', ...],...],...]
      const translated = data[0]
        .map((chunk: any[]) => chunk[0])
        .filter(Boolean)
        .join('');
      results.push(translated);
      // Small delay to reduce chance of rate limiting
      await new Promise(r => setTimeout(r, 50));
    }
    return results;
  },
};
