export type ProviderId = 'gtx' | 'google' | 'deepl' | 'microsoft';

// Per-provider config — only the fields relevant to that provider are used
export interface ProviderConfig {
  // Google Cloud
  googleApiKey?: string;

  // DeepL
  deeplApiKey?: string;
  deeplPlan?: 'free' | 'pro'; // determines base URL

  // Microsoft
  microsoftApiKey?: string;
  microsoftRegion?: string; // e.g. 'eastus', required for regional resources
}

export interface TranslationProvider {
  id: ProviderId;
  label: string;
  requiresKey: boolean; // false only for GTX
  translateBatch: (
    texts: string[], // plain text paragraph strings
    targetLang: string,
    config: ProviderConfig,
  ) => Promise<string[]>; // same order as input
}
