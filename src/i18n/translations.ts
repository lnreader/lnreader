import * as Localization from 'expo-localization';
import dayjs from 'dayjs';
import { I18n, TranslateOptions } from 'i18n-js';
import { MMKVStorage } from '@utils/mmkv/mmkv';

import customParseFormat from 'dayjs/plugin/customParseFormat';
import localeData from 'dayjs/plugin/localeData';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';
import calendar from 'dayjs/plugin/calendar';
import duration from 'dayjs/plugin/duration';

import { StringMap } from './types';
import { showToast } from '@utils/showToast';

dayjs.extend(customParseFormat);
dayjs.extend(localeData);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.extend(duration);

/**
 * The locale bundles add up to ~1.4 MB of JSON, and only the active locale
 * (plus the English fallback) is ever read. Importing them statically made the
 * engine materialise every one of those objects before the first frame could be
 * drawn. `require` keeps them all in the bundle — Metro resolves the paths at
 * build time — while deferring the object construction to whichever locales are
 * actually loaded below.
 */
const translationLoaders: Record<string, () => StringMap> = {
  'af': () => require('./languages/af_ZA/strings.json'),
  'ar': () => require('./languages/ar_SA/strings.json'),
  'as': () => require('./languages/as_IN/strings.json'),
  'ca': () => require('./languages/ca_ES/strings.json'),
  'cs': () => require('./languages/cs_CZ/strings.json'),
  'da': () => require('./languages/da_DK/strings.json'),
  'de': () => require('./languages/de_DE/strings.json'),
  'el': () => require('./languages/el_GR/strings.json'),
  'en': () => require('./languages/en/strings.json'),
  'es': () => require('./languages/es_ES/strings.json'),
  'fi': () => require('./languages/fi_FI/strings.json'),
  'fr': () => require('./languages/fr_FR/strings.json'),
  'he': () => require('./languages/he_IL/strings.json'),
  'hi': () => require('./languages/hi_IN/strings.json'),
  'hu': () => require('./languages/hu_HU/strings.json'),
  'id': () => require('./languages/id_ID/strings.json'),
  'it': () => require('./languages/it_IT/strings.json'),
  'ja': () => require('./languages/ja_JP/strings.json'),
  'ko': () => require('./languages/ko_KR/strings.json'),
  'nl': () => require('./languages/nl_NL/strings.json'),
  'no': () => require('./languages/no_NO/strings.json'),
  'or': () => require('./languages/or_IN/strings.json'),
  'pl': () => require('./languages/pl_PL/strings.json'),
  'pt': () => require('./languages/pt_PT/strings.json'),
  'pt-BR': () => require('./languages/pt_BR/strings.json'),
  'ro': () => require('./languages/ro_RO/strings.json'),
  'ru': () => require('./languages/ru_RU/strings.json'),
  'sq': () => require('./languages/sq_AL/strings.json'),
  'sr': () => require('./languages/sr_SP/strings.json'),
  'sv': () => require('./languages/sv_SE/strings.json'),
  'tr': () => require('./languages/tr_TR/strings.json'),
  'uk': () => require('./languages/uk_UA/strings.json'),
  'vi': () => require('./languages/vi_VN/strings.json'),
  'zh-CN': () => require('./languages/zh_CN/strings.json'),
  'zh-TW': () => require('./languages/zh_TW/strings.json'),
};

/**
 * Same idea for dayjs: each locale registers itself on the shared dayjs
 * instance as a side effect of being required, so only the ones we resolve to
 * need to run.
 */
const dayjsLocaleLoaders: Record<string, () => void> = {
  'ar': () => require('dayjs/locale/ar'),
  'ca': () => require('dayjs/locale/ca'),
  'cs': () => require('dayjs/locale/cs'),
  'da': () => require('dayjs/locale/da'),
  'de': () => require('dayjs/locale/de'),
  'el': () => require('dayjs/locale/el'),
  'es': () => require('dayjs/locale/es'),
  'fi': () => require('dayjs/locale/fi'),
  'fr': () => require('dayjs/locale/fr'),
  'he': () => require('dayjs/locale/he'),
  'hi': () => require('dayjs/locale/hi'),
  'hu': () => require('dayjs/locale/hu'),
  'id': () => require('dayjs/locale/id'),
  'it': () => require('dayjs/locale/it'),
  'ja': () => require('dayjs/locale/ja'),
  'ko': () => require('dayjs/locale/ko'),
  'nb': () => require('dayjs/locale/nb'),
  'nl': () => require('dayjs/locale/nl'),
  'pl': () => require('dayjs/locale/pl'),
  'pt': () => require('dayjs/locale/pt'),
  'pt-br': () => require('dayjs/locale/pt-br'),
  'ro': () => require('dayjs/locale/ro'),
  'ru': () => require('dayjs/locale/ru'),
  'sq': () => require('dayjs/locale/sq'),
  'sr': () => require('dayjs/locale/sr'),
  'sv': () => require('dayjs/locale/sv'),
  'tr': () => require('dayjs/locale/tr'),
  'uk': () => require('dayjs/locale/uk'),
  'vi': () => require('dayjs/locale/vi'),
  'zh-cn': () => require('dayjs/locale/zh-cn'),
  'zh-tw': () => require('dayjs/locale/zh-tw'),
};

const i18n = new I18n();
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

/**
 * `enableFallback` walks a tag down to its base language, so a device reporting
 * `pt-BR` resolves against `pt-BR` and then `pt`. Return every candidate the
 * lookup can reach so each one that we ship gets stored.
 */
const getLocaleCandidates = (locale: string): string[] => {
  const segments = locale.split('-');

  return segments
    .map((_, index) => segments.slice(0, segments.length - index).join('-'))
    .filter(candidate => candidate.length > 0);
};

const loadedLocales = new Set<string>();

const loadTranslations = (locale: string) => {
  const loader = translationLoaders[locale];
  if (!loader || loadedLocales.has(locale)) {
    return;
  }

  loadedLocales.add(locale);
  i18n.store({ [locale]: loader() });
};

const getSavedLocale = (): string => {
  try {
    return MMKVStorage.getString('APP_LOCALE') || '';
  } catch {
    return '';
  }
};

const getDayjsLocale = (locale: string): string => {
  const localeMap: Record<string, string> = {
    'no': 'nb', // Norwegian -> Norwegian Bokmål
    'pt-BR': 'pt-br',
    'zh-CN': 'zh-cn',
    'zh-TW': 'zh-tw',
  };
  return localeMap[locale] || locale;
};

const applyDayjsLocale = (locale: string) => {
  for (const candidate of getLocaleCandidates(locale)) {
    const dayjsLocale = getDayjsLocale(candidate);
    const loader = dayjsLocaleLoaders[dayjsLocale];
    if (!loader) {
      continue;
    }

    loader();
    dayjs.locale(dayjsLocale);
    return;
  }
};

const savedLocale = getSavedLocale();
const detectedLocale =
  savedLocale ||
  Localization.getLocales()[0]?.languageTag ||
  i18n.defaultLocale;

// The default locale backs every key the active locale is missing, so it has to
// be stored even when it is not the one in use.
loadTranslations(i18n.defaultLocale);
getLocaleCandidates(detectedLocale).forEach(loadTranslations);

i18n.locale = detectedLocale;
applyDayjsLocale(detectedLocale);

export const localization = detectedLocale;

export const setLocale = (locale: string) => {
  try {
    MMKVStorage.set('APP_LOCALE', locale);
  } catch (error) {
    showToast(`Failed to set locale: ${error}`);
  }
};

export { i18n };

type PluralSuffix = '.one' | '.other';

type TrimPlural<T extends string> = T extends `${infer Base}${PluralSuffix}`
  ? Base
  : T;

export const getString = (
  stringKey: keyof StringMap | TrimPlural<keyof StringMap>,
  options?: TranslateOptions,
) => i18n.t(stringKey, options);

// @ts-expect-error
dayjs.Ls[dayjs.locale()].calendar = {
  sameDay: getString('date.calendar.sameDay'),
  nextDay: getString('date.calendar.nextDay'),
  nextWeek: 'dddd',
  lastDay: getString('date.calendar.lastDay'),
  lastWeek: getString('date.calendar.lastWeek'),
  sameElse: 'LL',
};
