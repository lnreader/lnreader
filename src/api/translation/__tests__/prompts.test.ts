import {
  BUILT_IN_PROMPTS,
  DEFAULT_PROMPT_ID,
  formatPrompt,
  resolvePrompt,
} from '@api/translation/prompts';

describe('translation prompts', () => {
  it('has the five NoveLA-style built-in prompts', () => {
    expect(Object.keys(BUILT_IN_PROMPTS)).toEqual([
      'minimal',
      'balanced',
      'detailed',
      'adult',
      'direct-asian',
    ]);
    expect(DEFAULT_PROMPT_ID).toBe('balanced');
    for (const prompt of Object.values(BUILT_IN_PROMPTS)) {
      expect(prompt.content).toContain('{source_language}');
      expect(prompt.content).toContain('{target_language}');
    }
  });

  it('formats language placeholders into every prompt', () => {
    for (const prompt of Object.values(BUILT_IN_PROMPTS)) {
      const formatted = formatPrompt(prompt.content, 'ja', 'en');
      expect(formatted).not.toContain('{source_language}');
      expect(formatted).not.toContain('{target_language}');
      expect(formatted).toContain('ja');
      expect(formatted).toContain('en');
    }
  });

  it('treats the auto source language as a human readable label', () => {
    expect(
      formatPrompt(BUILT_IN_PROMPTS.balanced.content, 'auto', 'en'),
    ).toContain('Auto-detect');
  });

  it('resolves built-in, custom, none and unknown prompt ids', () => {
    const custom = [{ id: 'custom-one', name: 'Custom', content: 'Do work' }];
    expect(resolvePrompt('detailed', [])).toBe(
      BUILT_IN_PROMPTS.detailed.content,
    );
    expect(resolvePrompt('custom-one', custom)).toBe('Do work');
    expect(resolvePrompt(null, custom)).toBeUndefined();
    expect(resolvePrompt(undefined, custom)).toBeUndefined();
    expect(resolvePrompt('nope', custom)).toBeUndefined();
  });
});
