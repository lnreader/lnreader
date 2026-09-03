import {
  computeEffectiveTranslationSettings,
  initialTranslationSettings,
  mergeTranslationSettings,
} from '@api/translation/settings';
import { type RegexCleanupRule } from '@api/translation/types';

const baseSettings = () => ({
  ...initialTranslationSettings,
  perNovel: {} as typeof initialTranslationSettings.perNovel,
});

describe('translation settings resolution', () => {
  it('merges stored settings over defaults without mutating them', () => {
    const stored = {
      provider: 'GEMINI' as const,
      perNovel: { '7': { enabled: false } },
    };
    const merged = mergeTranslationSettings(stored);
    expect(merged.provider).toBe('GEMINI');
    expect(merged.parallelMode).toBe('PARALLEL_TRANSLATION_FIRST');
    expect(merged.useCommunityGooglePaKey).toBe(true);
    expect(merged.perNovel).toEqual({ '7': { enabled: false } });
    expect(stored.perNovel).toBe(merged.perNovel);
  });

  it('defaults the NoveLA engine knobs (batch 60, auto tokens, key lists)', () => {
    const merged = mergeTranslationSettings({});
    expect(merged.batchSize).toBe(60);
    expect(merged.maxOutputTokens).toBe(0);
    expect(merged.googlePaApiKeys).toBe('');
    expect(merged.googlePaCachedKey).toBe('');
    expect(merged.googlePaKeyLastChecked).toBe(0);
  });

  it('fingerprints the knobs that change translation output', () => {
    const settings = { ...baseSettings(), provider: 'GEMINI' as const };
    const base = computeEffectiveTranslationSettings(
      settings,
      1,
    ).providerFingerprint;
    expect(
      computeEffectiveTranslationSettings({ ...settings, batchSize: 30 }, 1)
        .providerFingerprint,
    ).not.toBe(base);
    expect(
      computeEffectiveTranslationSettings(
        { ...settings, maxOutputTokens: 1024 },
        1,
      ).providerFingerprint,
    ).not.toBe(base);
    expect(
      computeEffectiveTranslationSettings(
        { ...settings, geminiApiKey: 'k1\nk2' },
        1,
      ).providerFingerprint,
    ).not.toBe(base);
  });

  it('requires both the global switch and the per-novel switch', () => {
    const settings = { ...baseSettings(), enabled: true };
    expect(computeEffectiveTranslationSettings(settings, 1).enabled).toBe(true);
    expect(
      computeEffectiveTranslationSettings({ ...settings, enabled: false }, 1)
        .enabled,
    ).toBe(false);
    // A novel explicitly disabled stays disabled.
    settings.perNovel['1'] = { enabled: false };
    expect(computeEffectiveTranslationSettings(settings, 1).enabled).toBe(
      false,
    );
    // Absent per-novel record defaults to enabled.
    expect(computeEffectiveTranslationSettings(settings, 2).enabled).toBe(true);
  });

  it('lays per-novel language/parallel overrides on top of globals', () => {
    const settings = {
      ...baseSettings(),
      sourceLanguage: 'auto',
      targetLanguage: 'en',
      parallelMode: 'PARALLEL_TRANSLATION_FIRST' as const,
      perNovel: {
        '5': { sourceLanguage: 'ja', targetLanguage: 'vi' },
      },
    };
    expect(computeEffectiveTranslationSettings(settings, 5)).toMatchObject({
      sourceLanguage: 'ja',
      targetLanguage: 'vi',
      parallelMode: 'PARALLEL_TRANSLATION_FIRST',
    });
    expect(computeEffectiveTranslationSettings(settings, 6)).toMatchObject({
      sourceLanguage: 'auto',
      targetLanguage: 'en',
    });
  });

  it('resolves effective prompt id across the three possible values', () => {
    const settings = { ...baseSettings(), defaultPromptId: 'balanced' };
    expect(computeEffectiveTranslationSettings(settings, 1).promptId).toBe(
      'balanced',
    );
    settings.perNovel['1'] = { promptId: 'detailed' };
    expect(computeEffectiveTranslationSettings(settings, 1).promptId).toBe(
      'detailed',
    );
    settings.perNovel['1'] = { promptId: null };
    expect(
      computeEffectiveTranslationSettings(settings, 1).promptId,
    ).toBeNull();
  });

  it('merges regex rules as global then per-novel (NoveLA order)', () => {
    const globalRule: RegexCleanupRule = {
      pattern: 'a',
      replacement: '',
      enabled: true,
    };
    const perRule: RegexCleanupRule = {
      pattern: 'b',
      replacement: '',
      enabled: true,
    };
    const settings = {
      ...baseSettings(),
      regexRules: [globalRule],
      perNovel: { '3': { regexRules: [perRule] } },
    };
    expect(computeEffectiveTranslationSettings(settings, 3).regexRules).toEqual(
      [globalRule, perRule],
    );
  });
});
