import {
  LLM_PROVIDERS,
  PROVIDER_CATEGORY,
  PROVIDER_FIELDS,
  PROVIDER_LABELS,
} from '../providerMeta';
import {
  TRANSLATION_PROVIDER_IDS,
  getDefaultConfig,
} from '@services/translation';

describe('provider metadata', () => {
  it('covers every registered provider', () => {
    for (const id of TRANSLATION_PROVIDER_IDS) {
      expect(PROVIDER_LABELS[id]).toBeTruthy();
      expect(PROVIDER_CATEGORY[id]).toBeTruthy();
      expect(PROVIDER_FIELDS[id]).toBeDefined();
    }
  });

  it('describes no field a provider does not actually have', () => {
    // The screen reads these keys off the config union; a field listed here
    // but missing from the config would render a permanently blank row.
    for (const id of TRANSLATION_PROVIDER_IDS) {
      const config = getDefaultConfig(id) as unknown as Record<string, unknown>;
      for (const spec of PROVIDER_FIELDS[id]) {
        expect(Object.keys(config)).toContain(spec.key);
      }
    }
  });

  it('exposes prompt fields for exactly the LLM providers', () => {
    for (const id of TRANSLATION_PROVIDER_IDS) {
      const keys = PROVIDER_FIELDS[id].map(spec => spec.key);
      const hasPrompts =
        keys.includes('systemPrompt') && keys.includes('userPromptTemplate');
      expect(hasPrompts).toBe(LLM_PROVIDERS.has(id));
    }
  });

  it('guards the user prompt template against losing {TEXT}', () => {
    for (const id of LLM_PROVIDERS) {
      const spec = PROVIDER_FIELDS[id].find(
        field => field.key === 'userPromptTemplate',
      );
      expect(spec?.requiredPlaceholder).toBe('{TEXT}');
    }
  });

  it('ships default prompt templates that satisfy their own guard', () => {
    for (const id of LLM_PROVIDERS) {
      const config = getDefaultConfig(id) as unknown as Record<string, string>;
      expect(config.userPromptTemplate).toContain('{TEXT}');
      expect(config.systemPrompt).toBeTruthy();
    }
  });

  it('renders multi-line editors for templates and prompts', () => {
    const multiline = PROVIDER_FIELDS.customhttp
      .filter(spec => spec.multiline)
      .map(spec => spec.key);
    expect(multiline).toEqual(['headersTemplate', 'bodyTemplate']);
  });
});
