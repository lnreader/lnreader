/**
 * Target languages offered in the UI.
 *
 * Deliberately a curated list rather than every ISO code: the providers
 * disagree on which codes they accept, and an unsupported one fails at request
 * time with a provider-specific error the user cannot act on.
 *
 * Lives in the service rather than a screen because both the global settings
 * screen and the per-novel override use it.
 */
export interface TranslationLanguage {
  value: string;
  label: string;
}

export const TARGET_LANGUAGES: TranslationLanguage[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'th', label: 'ไทย' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

export const languageLabel = (code: string): string =>
  TARGET_LANGUAGES.find(language => language.value === code)?.label ?? code;
