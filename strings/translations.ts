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
dayjs.extend(customParseFormat);
dayjs.extend(localeData);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.extend(calendar);
dayjs.extend(duration);

import 'dayjs/locale/ar';
import 'dayjs/locale/ca';
import 'dayjs/locale/cs';
import 'dayjs/locale/da';
import 'dayjs/locale/de';
import 'dayjs/locale/el';
import 'dayjs/locale/es';
import 'dayjs/locale/fi';
import 'dayjs/locale/fr';
import 'dayjs/locale/he';
import 'dayjs/locale/hi';
import 'dayjs/locale/hu';
import 'dayjs/locale/id';
import 'dayjs/locale/it';
import 'dayjs/locale/ja';
import 'dayjs/locale/ko';
import 'dayjs/locale/nb';
import 'dayjs/locale/nl';
import 'dayjs/locale/pl';
import 'dayjs/locale/pt';
import 'dayjs/locale/ro';
import 'dayjs/locale/ru';
import 'dayjs/locale/sq';
import 'dayjs/locale/sr';
import 'dayjs/locale/sv';
import 'dayjs/locale/tr';
import 'dayjs/locale/uk';
import 'dayjs/locale/vi';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/zh-tw';

import af from './languages/af_ZA/strings.json';
import ar from './languages/ar_SA/strings.json';
import as from './languages/as_IN/strings.json';
import ca from './languages/ca_ES/strings.json';
import cs from './languages/cs_CZ/strings.json';
import da from './languages/da_DK/strings.json';
import de from './languages/de_DE/strings.json';
import el from './languages/el_GR/strings.json';
import en from './languages/en/strings.json';
import es from './languages/es_ES/strings.json';
import fi from './languages/fi_FI/strings.json';
import fr from './languages/fr_FR/strings.json';
import he from './languages/he_IL/strings.json';
import hi from './languages/hi_IN/strings.json';
import hu from './languages/hu_HU/strings.json';
import id from './languages/id_ID/strings.json';
import it from './languages/it_IT/strings.json';
import ja from './languages/ja_JP/strings.json';
import ko from './languages/ko_KR/strings.json';
import nl from './languages/nl_NL/strings.json';
import no from './languages/no_NO/strings.json';
import or from './languages/or_IN/strings.json';
import pl from './languages/pl_PL/strings.json';
import pt from './languages/pt_PT/strings.json';
import ptBr from './languages/pt_BR/strings.json';
import ro from './languages/ro_RO/strings.json';
import ru from './languages/ru_RU/strings.json';
import sq from './languages/sq_AL/strings.json';
import sr from './languages/sr_SP/strings.json';
import sv from './languages/sv_SE/strings.json';
import tr from './languages/tr_TR/strings.json';
import uk from './languages/uk_UA/strings.json';
import vi from './languages/vi_VN/strings.json';
import zhCn from './languages/zh_CN/strings.json';
import zhTw from './languages/zh_TW/strings.json';

import { StringMap } from './types';
import { showToast } from '@utils/showToast';

const i18n = new I18n({
  af,
  ar,
  as,
  ca,
  cs,
  da,
  de,
  el,
  en,
  es,
  fi,
  fr,
  he,
  hi,
  hu,
  id,
  it,
  ja,
  ko,
  nl,
  no,
  or,
  pl,
  pt,
  'pt-BR': ptBr,
  ro,
  ru,
  sq,
  sr,
  sv,
  tr,
  uk,
  vi,
  'zh-CN': zhCn,
  'zh-TW': zhTw,
});
i18n.defaultLocale = 'en';
i18n.enableFallback = true;

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

const savedLocale = getSavedLocale();
const detectedLocale =
  savedLocale ||
  Localization.getLocales()[0]?.languageTag ||
  i18n.defaultLocale;

i18n.locale = detectedLocale;
dayjs.locale(getDayjsLocale(detectedLocale));

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

type TrimPlural<T extends string> = T extends `${infer Base}${PluralSuffix}` ? Base : T;

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
