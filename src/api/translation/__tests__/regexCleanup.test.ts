import { applyRegexCleanupRules } from '@api/translation/regexCleanup';
import type { RegexCleanupRule } from '@api/translation/types';

const rule = (
  pattern: string,
  replacement = '',
  enabled = true,
): RegexCleanupRule => ({ pattern, replacement, enabled });

describe('translation regex cleanup rules', () => {
  it('replaces literal text', () => {
    expect(applyRegexCleanupRules('foo bar foo', [rule('foo', 'baz')])).toBe(
      'baz bar baz',
    );
  });

  it('replaces regex patterns globally even without the g flag', () => {
    expect(applyRegexCleanupRules('a1 b2 c3', [rule('/[0-9]/', 'X')])).toBe(
      'aX bX cX',
    );
  });

  it('applies rules in order', () => {
    const rules = [rule('a', 'b'), rule('b', 'c')];
    expect(applyRegexCleanupRules('a', rules)).toBe('c');
  });

  it('skips disabled and empty rules', () => {
    expect(
      applyRegexCleanupRules('hello', [
        rule('hello', 'bye', false),
        rule('', 'x'),
      ]),
    ).toBe('hello');
  });

  it('leaves text untouched when a regex is invalid', () => {
    expect(applyRegexCleanupRules('hello', [rule('/[/u', 'x')])).toBe('hello');
  });
});
