/**
 * Which config fields each provider exposes in the settings UI.
 *
 * Driven by metadata rather than per-provider conditionals so that adding a
 * provider stays a one-line change here, and so the screen cannot drift out of
 * sync with the config union.
 */
import type { StringMap } from '@i18n/types';
import type { TranslationProviderId } from '@services/translation';

/** Product names, intentionally not translated. */
export const PROVIDER_LABELS: Record<TranslationProviderId, string> = {
  libretranslate: 'LibreTranslate',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  nvidianim: 'NVIDIA NIM',
  huggingface: 'HuggingFace',
  microsoft: 'Microsoft Translator',
  systran: 'SYSTRAN',
  customhttp: 'Custom HTTP',
};

/** Grouping shown as a subheader, matching the categories in spec §6.4. */
export type ProviderCategory =
  | 'freeNoKey'
  | 'apiKey'
  | 'selfHosted'
  | 'escapeHatch';

export const PROVIDER_CATEGORY: Record<
  TranslationProviderId,
  ProviderCategory
> = {
  libretranslate: 'freeNoKey',
  gemini: 'apiKey',
  openai: 'apiKey',
  deepseek: 'apiKey',
  huggingface: 'apiKey',
  microsoft: 'apiKey',
  systran: 'apiKey',
  ollama: 'selfHosted',
  nvidianim: 'selfHosted',
  customhttp: 'escapeHatch',
};

export type ProviderFieldKey =
  | 'endpoint'
  | 'model'
  | 'region'
  | 'url'
  | 'headersTemplate'
  | 'bodyTemplate'
  | 'responsePath';

export interface ProviderFieldSpec {
  key: ProviderFieldKey;
  labelKey: keyof StringMap;
  /** Rendered as a multi-line editor and not truncated in the row. */
  multiline?: boolean;
  keyboardType?: 'default' | 'url';
}

const FIELD_SPECS: Record<ProviderFieldKey, ProviderFieldSpec> = {
  endpoint: {
    key: 'endpoint',
    labelKey: 'translationSettings.serverUrl',
    keyboardType: 'url',
  },
  model: { key: 'model', labelKey: 'translationSettings.model' },
  region: { key: 'region', labelKey: 'translationSettings.region' },
  url: {
    key: 'url',
    labelKey: 'translationSettings.requestUrl',
    keyboardType: 'url',
  },
  headersTemplate: {
    key: 'headersTemplate',
    labelKey: 'translationSettings.headers',
    multiline: true,
  },
  bodyTemplate: {
    key: 'bodyTemplate',
    labelKey: 'translationSettings.bodyTemplate',
    multiline: true,
  },
  responsePath: {
    key: 'responsePath',
    labelKey: 'translationSettings.responsePath',
  },
};

const fields = (...keys: ProviderFieldKey[]): ProviderFieldSpec[] =>
  keys.map(key => FIELD_SPECS[key]);

export const PROVIDER_FIELDS: Record<
  TranslationProviderId,
  ProviderFieldSpec[]
> = {
  libretranslate: fields('endpoint'),
  gemini: fields('model'),
  ollama: fields('endpoint', 'model'),
  openai: fields('endpoint', 'model'),
  deepseek: fields('endpoint', 'model'),
  nvidianim: fields('endpoint', 'model'),
  huggingface: fields('endpoint', 'model'),
  microsoft: fields('endpoint', 'region'),
  systran: fields('endpoint'),
  customhttp: fields('url', 'headersTemplate', 'bodyTemplate', 'responsePath'),
};

/**
 * Providers whose translation quality depends on prompting. Their prompt
 * fields are editable in Phase 3; this flag is what the UI will key off.
 */
export const LLM_PROVIDERS: ReadonlySet<TranslationProviderId> = new Set([
  'gemini',
  'ollama',
  'openai',
  'deepseek',
  'nvidianim',
  'huggingface',
]);
