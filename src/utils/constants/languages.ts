// references:
// https://en.wikipedia.org/wiki/IETF_language_tag
// https://en.wikipedia.org/wiki/List_of_language_names

import { getString } from '@i18n/translations';

export const languagesMapping: Record<string, string> = {
  'id': 'Bahasa Indonesia',
  'en': 'English',
  'es': 'Español',
  'fr': 'Français',
  'pl': 'Polski',
  'pt': 'Português',
  'vi': 'Tiếng Việt',
  'tr': 'Türkçe',
  'ru': 'Русский',
  'uk': 'Українська',
  'ab': '‎العربية',
  'th': 'ไทย',
  'zh': '中文, 汉语, 漢語',
  'ja': '日本語',
  'ko': '조선말, 한국어',
  'multi': 'Multi',
};

export const languages = Object.values(languagesMapping);

export const getLocaleLanguageName = (lang: string): string => {
  if (lang !== 'Multi') return lang;
  return getString('browseSettingsScreen.multi');
};
