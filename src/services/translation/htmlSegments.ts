/**
 * Extracting translatable text out of chapter HTML and putting it back.
 *
 * Chapter content is HTML, not plain text. Sending the raw markup to a
 * provider (especially an LLM one) invites mangled or hallucinated tags and
 * breaks the `file://` image `src`s that `downloadChapter` rewrites for
 * downloaded chapters. So only text nodes travel to the provider; the document
 * structure never leaves the device.
 */
import * as cheerio from 'cheerio';

/** Never send the contents of these to a translation provider. */
const SKIPPED_PARENTS = new Set(['script', 'style', 'noscript', 'code', 'pre']);

interface TextNodeLike {
  type: string;
  data?: string;
  parent?: { type: string; name?: string } | null;
}

export interface SegmentedDocument {
  /** Trimmed, non-empty text runs in document order. */
  segments: string[];
  /**
   * Writes translations back into the document and serialises it.
   *
   * Accepts a sparse array: an entry that is `undefined` or empty leaves that
   * segment in its original language. This is what makes a partially failed
   * chapter render as "mostly translated" rather than corrupt — the spec's
   * resilience requirement (§7).
   */
  rebuild: (translations: readonly (string | undefined)[]) => string;
}

export const segmentHtml = (html: string): SegmentedDocument => {
  const $ = cheerio.load(html);
  const nodes: TextNodeLike[] = [];
  const segments: string[] = [];
  /** Whitespace stripped for translation, restored on rebuild. */
  const affixes: [prefix: string, suffix: string][] = [];

  $('*')
    .contents()
    .each((_, node) => {
      const candidate = node as unknown as TextNodeLike;
      if (candidate.type !== 'text') {
        return;
      }
      const raw = candidate.data ?? '';
      const trimmed = raw.trim();
      if (!trimmed) {
        return;
      }
      const parent = candidate.parent;
      if (parent?.name && SKIPPED_PARENTS.has(parent.name)) {
        return;
      }

      const prefix = raw.slice(0, raw.indexOf(trimmed[0]));
      const suffix = raw.slice(prefix.length + trimmed.length);

      nodes.push(candidate);
      segments.push(trimmed);
      affixes.push([prefix, suffix]);
    });

  const rebuild = (translations: readonly (string | undefined)[]) => {
    nodes.forEach((node, i) => {
      const translated = translations[i];
      if (typeof translated === 'string' && translated.trim()) {
        const [prefix, suffix] = affixes[i];
        node.data = `${prefix}${translated}${suffix}`;
      }
    });
    return $.html();
  };

  return { segments, rebuild };
};
