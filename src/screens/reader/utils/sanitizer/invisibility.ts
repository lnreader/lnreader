import type { CheerioAPI } from 'cheerio';

/**
 * Patterns in style attributes indicating invisible or hidden text.
 */
const HIDDEN_STYLE_REGEXES = [
  /display\s*:\s*none/i,
  /visibility\s*:\s*hidden/i,
  /opacity\s*:\s*0(?:\.0+)?(?:\s*;|\s*$)/i,
  /font-size\s*:\s*0(?:px|pt|em|rem)?(?:\s*;|\s*$)/i,
  /(?:height|max-height|width|max-width)\s*:\s*0(?:px|pt|em|rem)?(?:\s*;|\s*$)/i,
  /position\s*:\s*absolute\s*;\s*(?:left|top|right|bottom)\s*:\s*-\d{3,}/i,
  /text-indent\s*:\s*-\d{3,}/i,
  /clip\s*:\s*rect\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/i,
  /transform\s*:\s*scale\s*\(\s*0\s*\)/i,
];

/**
 * Common class names used on novel aggregator sites for honeypot traps.
 */
const HONEYPOT_CLASS_REGEXES = [
  /(?:^|\s)(?:hidden|invisible|d-none|screen-reader-text|sr-only)(?:\s|$)/i,
  /(?:^|\s)(?:tts-trap|honey-?pot|anti-?scrap|fake-?text|decoy-?text)(?:\s|$)/i,
  /(?:^|\s)(?:hide-text|offscreen|zero-size)(?:\s|$)/i,
];

/**
 * Checks whether an element or any of its styles indicates it should be hidden from readers/TTS.
 */
export function isElementInvisible($el: ReturnType<CheerioAPI>): boolean {
  // Check boolean HTML attributes
  if ($el.is('[hidden]') || $el.attr('aria-hidden') === 'true') {
    return true;
  }

  // Check inline style attribute
  const style = $el.attr('style');
  if (style) {
    for (const regex of HIDDEN_STYLE_REGEXES) {
      if (regex.test(style)) {
        return true;
      }
    }
  }

  // Check honeypot / trap class names
  const className = $el.attr('class');
  if (className) {
    for (const regex of HONEYPOT_CLASS_REGEXES) {
      if (regex.test(className)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Recursively strips invisible and honeypot elements from the DOM.
 */
export function stripHiddenElements($: CheerioAPI): number {
  let strippedCount = 0;

  // Search all elements that have style, hidden, aria-hidden, or class
  $('*').each((_, element) => {
    const $el = $(element);
    if (isElementInvisible($el)) {
      $el.remove();
      strippedCount++;
    }
  });

  return strippedCount;
}
