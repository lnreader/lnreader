/**
 * Regex cleanup rules applied to chapter text before display and translation
 * (mirrors NoveLA's applyUserRegexRules). Rules run in order; each rule is
 * either a literal text pattern or a `/pattern/flags` regex string.
 */

import type { RegexCleanupRule } from './types';

const REGEX_PATTERN = /^\/(.*)\/([gmiyuvsd]*)$/;

const VALID_FLAGS = new Set(['g', 'm', 'i', 'y', 'u', 'v', 's', 'd']);

const applyRegexRule = (
  text: string,
  pattern: string,
  flags: string,
  replacement: string,
): string => {
  if ([...flags].some(f => !VALID_FLAGS.has(f))) return text;
  // Cleanup rules always replace every occurrence.
  const effective = flags.includes('g') ? flags : `${flags}g`;
  try {
    return text.replace(new RegExp(pattern, effective), replacement);
  } catch {
    return text;
  }
};

export const applyRegexCleanupRules = (
  text: string,
  rules: RegexCleanupRule[],
): string => {
  let result = text;
  for (const rule of rules) {
    if (!rule.enabled || !rule.pattern) continue;
    const match = REGEX_PATTERN.exec(rule.pattern);
    if (match) {
      result = applyRegexRule(
        result,
        match[1],
        match[2] ?? '',
        rule.replacement,
      );
    } else {
      result = result.split(rule.pattern).join(rule.replacement);
    }
  }
  return result;
};
