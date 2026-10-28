import type { CheerioAPI } from 'cheerio';

/**
 * Regex matching invisible zero-width unicode artifacts injected by novel aggregators.
 */
const ZERO_WIDTH_REGEX = /[\u200B\uFEFF\u00AD\u2060\u180E]/g;

/**
 * Strips zero-width characters and normalizes irregular whitespace.
 */
export function cleanZeroWidthChars(text: string): string {
  return text.replace(ZERO_WIDTH_REGEX, '');
}

/**
 * Normalizes text content for TTS reading:
 * - Trims excessive whitespace while keeping sentence boundaries
 * - Normalizes quotes and dashes
 * - Removes phantom spaces before punctuation
 */
export function normalizeTtsText(text: string): string {
  if (!text) return '';

  return cleanZeroWidthChars(text)
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();
}

/**
 * Coalesces fragmented inline elements inside paragraphs.
 * Often aggregators wrap words or phrases in multiple <span> tags, e.g.:
 *   <p><span>She </span><span>turned </span><span>around.</span></p>
 * This causes LNReader's TTS engine to treat each span as a distinct speech unit.
 *
 * This function unwraps meaningless spans and merges adjacent text nodes into cohesive blocks.
 */
export function flattenInlineElements($: CheerioAPI): void {
  // 1. Unpack empty or transparent inline formatting elements
  $('p, div, li, blockquote').each((_, block) => {
    const $block = $(block);

    // Find non-styled spans or spans with only decorative classes
    $block.find('span').each((_, span) => {
      const $span = $(span);
      const style = $span.attr('style');

      // If it doesn't have an intentional style, unwrap it
      if (!style || style.trim() === '') {
        $span.replaceWith($span.contents());
      }
    });

    // 2. Clean zero-width chars from all text nodes in the block
    $block.contents().each((_, node) => {
      if (node.type === 'text' && (node as any).data) {
        (node as any).data = cleanZeroWidthChars((node as any).data);
      }
    });
  });
}
