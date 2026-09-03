export const TRANSLATION_SETTINGS = 'TRANSLATION_SETTINGS';

export const initialTranslationSettings = {
  enabled: false,
  provider: 'GOOGLE_PA',
  parallelMode: 'PARALLEL_TRANSLATION_FIRST',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  defaultPromptId: 'balanced',
  googlePaApiKey: '',
  useCommunityGooglePaKey: true,
  googlePaApiKeys: '',
  googlePaCachedKey: '',
  googlePaKeyLastChecked: 0,
  geminiApiKey: '',
  geminiModel: 'gemini-2.0-flash',
  openaiApiKey: '',
  openaiEndpoint: 'https://api.openai.com/v1',
  openaiModel: 'gpt-4o-mini',
  batchSize: 60,
  maxOutputTokens: 0,
  prompts: [],
  regexRules: [],
  perNovel: {},
};

export const useTranslationSettings = jest.fn(() => ({
  ...initialTranslationSettings,
  setTranslationSettings: jest.fn(),
  setPerNovelTranslationSettings: jest.fn(),
}));

export const getTranslationSettings = jest.fn(() => ({
  ...initialTranslationSettings,
}));

export const setAppTranslationSettings = jest.fn();

export const getEffectiveTranslationSettings = jest.fn(() => ({
  enabled: false,
  provider: 'GOOGLE_PA',
  sourceLanguage: 'auto',
  targetLanguage: 'en',
  parallelMode: 'PARALLEL_TRANSLATION_FIRST',
  promptId: 'balanced',
  regexRules: [],
}));

export default {
  useTranslationSettings,
  getTranslationSettings,
  setAppTranslationSettings,
  getEffectiveTranslationSettings,
};
