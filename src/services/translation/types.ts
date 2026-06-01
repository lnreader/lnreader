export type ProviderId = 'gtx' | 'google' | 'deepl' | 'microsoft';

export type TranslationConfig =
  | { provider: 'gtx' }
  | { provider: 'google' }
  | { provider: 'deepl'; plan: 'free' | 'pro' }
  | { provider: 'microsoft'; region: string };

export interface TranslationProvider {
  id: ProviderId;
  label: string;
  requiresKey: boolean; // false only for GTX
  translateBatch: (
    texts: string[], // plain text paragraph strings
    targetLang: string,
    config: TranslationConfig,
    apiKey: string,
  ) => Promise<string[]>; // same order as input
}
