import type { CheerioAPI } from 'cheerio';
import type { NovelProfile } from './types';

/**
 * Applies a novel-specific profile rule set to the Cheerio DOM.
 * This runs before generic sanitization so novel-specific selectors are pruned immediately.
 */
export function applyNovelProfile($: CheerioAPI, profile: NovelProfile): void {
  // 1. Remove elements matching novel-specific exclude selectors
  if (profile.excludeSelectors && profile.excludeSelectors.length > 0) {
    for (const selector of profile.excludeSelectors) {
      if (selector && selector.trim()) {
        try {
          $(selector).remove();
        } catch (e) {
          // ignore
        }
      }
    }
  }

  // 2. Apply text strip regexes across text nodes
  if (profile.stripRegexes && profile.stripRegexes.length > 0) {
    const compiledRegexes: RegExp[] = [];
    for (const pattern of profile.stripRegexes) {
      try {
        // Handle inline flags like (?i)
        let regexPattern = pattern;
        let flags = 'g';
        if (pattern.startsWith('(?i)')) {
          flags = 'gi';
          regexPattern = pattern.substring(4);
        }
        compiledRegexes.push(new RegExp(regexPattern, flags));
      } catch (e) {
        // ignore
      }
    }

    if (compiledRegexes.length > 0) {
      $('*')
        .contents()
        .each((_, node) => {
          if (node.type === 'text' && (node as any).data) {
            let text = (node as any).data;
            for (const regex of compiledRegexes) {
              text = text.replace(regex, '');
            }
            (node as any).data = text;
          }
        });
    }
  }
}
