export type ProviderId = 'gtx' | 'google' | 'deepl' | 'microsoft';

export interface TranslationProvider {
  id: ProviderId;
  label: string;
  requiresKey: boolean;
  /**
   * Translate an array of plain-text strings and return them in the same order.
   * @param texts - plain text paragraphs to translate
   * @param targetLang - BCP-47 language code (e.g. 'ar', 'en', 'ja')
   * @param apiKey - API key for providers that require one
   * @param extra - provider-specific config (e.g. { plan: 'free' } for DeepL)
   */
  translateBatch(
    texts: string[],
    targetLang: string,
    apiKey?: string,
    extra?: Record<string, string>,
  ): Promise<string[]>;
}

export const PROVIDER_LIST: {
  id: ProviderId;
  label: string;
  requiresKey: boolean;
}[] = [
  { id: 'gtx', label: 'Google Translate (Free)', requiresKey: false },
  { id: 'google', label: 'Google Cloud Translate', requiresKey: true },
  { id: 'deepl', label: 'DeepL', requiresKey: true },
  { id: 'microsoft', label: 'Microsoft Azure Translator', requiresKey: true },
];
