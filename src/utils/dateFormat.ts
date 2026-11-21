import dayjs, { ConfigType } from 'dayjs';
import calendar from 'dayjs/plugin/calendar';
import localizedFormat from 'dayjs/plugin/localizedFormat';

import { getString, localization } from '@i18n/translations';

dayjs.extend(calendar);
dayjs.extend(localizedFormat);

export type DateFormat =
  | 'default'
  | 'MM/DD/YY'
  | 'DD/MM/YY'
  | 'YYYY-MM-DD'
  | 'DD MMM YYYY'
  | 'MMM DD, YYYY';

export const DATE_FORMATS: DateFormat[] = [
  'default',
  'MM/DD/YY',
  'DD/MM/YY',
  'YYYY-MM-DD',
  'DD MMM YYYY',
  'MMM DD, YYYY',
];

const DATE_FORMAT_NAMES: Record<Exclude<DateFormat, 'default'>, string> = {
  'MM/DD/YY': 'MM/dd/yy',
  'DD/MM/YY': 'dd/MM/yy',
  'YYYY-MM-DD': 'yyyy-MM-dd',
  'DD MMM YYYY': 'dd MMM yyyy',
  'MMM DD, YYYY': 'MMM dd, yyyy',
};

// Building an Intl.DateTimeFormat costs far more than formatting with one, and
// chapter lists format thousands of dates at a time.
let defaultFormatter: { locale: string; format: Intl.DateTimeFormat } | null =
  null;

const formatDefaultDate = (date: Date): string => {
  try {
    if (!defaultFormatter || defaultFormatter.locale !== localization) {
      defaultFormatter = {
        locale: localization,
        format: new Intl.DateTimeFormat(localization, { dateStyle: 'short' }),
      };
    }
    return defaultFormatter.format.format(date);
  } catch {
    return dayjs(date).format('L');
  }
};

const isWithinRelativeRange = (dayDifference: number) =>
  dayDifference >= -6 && dayDifference < 7;

export const formatDate = (
  value: ConfigType,
  dateFormat: DateFormat = 'default',
  relativeTimestamps = true,
  now: ConfigType = dayjs(),
): string => {
  const date = dayjs(value);
  if (!date.isValid()) {
    return typeof value === 'string' ? value : '';
  }

  if (relativeTimestamps) {
    const referenceDate = dayjs(now);
    const dayDifference = date
      .startOf('day')
      .diff(referenceDate.startOf('day'), 'day');
    if (isWithinRelativeRange(dayDifference)) {
      return date.calendar(referenceDate);
    }
  }

  return dateFormat === 'default'
    ? formatDefaultDate(date.toDate())
    : date.format(dateFormat);
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * `formatDate` for many dates at once: "now" is fixed when the formatter is
 * created and repeated values are cached. Make a new one per batch of rows.
 */
export const createDateFormatter = (
  dateFormat: DateFormat = 'default',
  relativeTimestamps = true,
  now: ConfigType = dayjs(),
): ((value: ConfigType) => string) => {
  const reference = dayjs(now);
  const referenceMs = reference.valueOf();
  const referenceDay = reference.startOf('day');
  const cache = new Map<unknown, string>();

  return value => {
    const cached = cache.get(value);
    if (cached !== undefined) {
      return cached;
    }
    const date = dayjs(value);
    let result: string;
    if (!date.isValid()) {
      result = typeof value === 'string' ? value : '';
    } else if (
      relativeTimestamps &&
      // Cheap pre-check; the exact calendar-day test below matches formatDate.
      Math.abs(date.valueOf() - referenceMs) < 8 * DAY_MS &&
      isWithinRelativeRange(date.startOf('day').diff(referenceDay, 'day'))
    ) {
      result = date.calendar(reference);
    } else {
      result =
        dateFormat === 'default'
          ? formatDefaultDate(date.toDate())
          : date.format(dateFormat);
    }
    cache.set(value, result);
    return result;
  };
};

export const getDateFormatLabel = (
  dateFormat: DateFormat,
  sampleDate: ConfigType = dayjs(),
): string => {
  const sample = formatDate(sampleDate, dateFormat, false);
  return dateFormat === 'default'
    ? getString('appearanceScreen.dateFormatDefault', { date: sample })
    : `${DATE_FORMAT_NAMES[dateFormat]} (${sample})`;
};
