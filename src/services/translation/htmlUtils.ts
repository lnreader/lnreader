export function extractParagraphs(html: string): {
  texts: string[];
  rebuild: (translated: string[]) => string;
} {
  const TAG_RE = /(<p(?:\s[^>]*)?>)([\s\S]*?)(<\/p>)/gi;
  const matches = [...html.matchAll(TAG_RE)];

  // Track which match indices had non-empty text, so rebuild can map correctly
  const indexMap: number[] = [];
  const texts: string[] = [];

  matches.forEach((m, i) => {
    const text = stripTags(m[2]).trim();
    if (text) {
      texts.push(text);
      indexMap.push(i);
    }
  });

  const rebuild = (translated: string[]): string => {
    // Build a map of match index → translated text
    const translationByMatch = new Map<number, string>();
    indexMap.forEach((matchIdx, i) => {
      translationByMatch.set(matchIdx, translated[i]);
    });

    let matchCount = 0;
    return html.replace(TAG_RE, (_, open, inner, close) => {
      const idx = matchCount++;
      const t = translationByMatch.get(idx);
      return t ? `${open}${t}${close}` : `${open}${inner}${close}`;
    });
  };

  return { texts, rebuild };
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}
