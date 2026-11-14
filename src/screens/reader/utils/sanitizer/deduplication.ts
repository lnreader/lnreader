import type { CheerioAPI } from 'cheerio';
import { normalizeTtsText } from './flattener';

/**
 * Tokenizes a string into normalized lowercase word tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
}

/**
 * Computes Jaccard similarity between two token lists.
 */
export function computeTokenSimilarity(textA: string, textB: string): number {
  const normA = normalizeTtsText(textA);
  const normB = normalizeTtsText(textB);

  // Exact match
  if (normA === normB) return 1.0;
  if (!normA || !normB) return 0.0;

  const tokensA = new Set(tokenize(normA));
  const tokensB = new Set(tokenize(normB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0.0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) {
      intersection++;
    }
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Sliding-window paragraph deduplicator to fix the "Double Reading / Clone Trap".
 * Aggregators frequently inject clone paragraphs right after or within 1-2 elements
 * of the original paragraph.
 *
 * @param $ Cheerio root instance
 * @param windowSize Number of preceding paragraphs to check against (default: 2)
 * @param threshold Similarity threshold above which a paragraph is considered a clone (default: 0.95)
 * @returns Number of duplicate paragraphs pruned
 */
export function deduplicateAdjacentParagraphs(
  $: CheerioAPI,
  windowSize = 2,
  threshold = 0.95,
): number {
  let prunedCount = 0;
  const recentParagraphs: { text: string; $el: ReturnType<CheerioAPI> }[] = [];

  $('p').each((_, p) => {
    const $p = $(p);
    const text = normalizeTtsText($p.text());

    // Skip empty paragraphs or meaningless characters
    if (text.length < 5) {
      return;
    }

    let isDuplicate = false;
    for (const recent of recentParagraphs) {
      const similarity = computeTokenSimilarity(text, recent.text);
      if (similarity === 1.0) {
        isDuplicate = true;
        break;
      }
      if (similarity >= threshold && text.length >= 30) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      $p.remove();
      prunedCount++;
    } else {
      recentParagraphs.push({ text, $el: $p });
      if (recentParagraphs.length > windowSize) {
        recentParagraphs.shift();
      }
    }
  });

  return prunedCount;
}
