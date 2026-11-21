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
// lists format many dates in a row. A formatter keeps the time zone it was
// built in, so it's rebuilt when the device's UTC offset changes (a time zone
// change, or a DST switch).
let defaultFormatter: {
  locale: string;
  utcOffset: number;
  format: Intl.DateTimeFormat;
} | null = null;

const formatDefaultDate = (date: Date): string => {
  try {
    const utcOffset = new Date().getTimezoneOffset();
    if (
      !defaultFormatter ||
      defaultFormatter.locale !== localization ||
      defaultFormatter.utcOffset !== utcOffset
    ) {
      defaultFormatter = {
        locale: localization,
        utcOffset,
        format: new Intl.DateTimeFormat(localization, { dateStyle: 'short' }),
      };
    }
    return defaultFormatter.format.format(date);
  } catch {
    return dayjs(date).format('L');
  }
};

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
    if (dayDifference >= -6 && dayDifference < 7) {
      return date.calendar(referenceDate);
    }
  }

  return dateFormat === 'default'
    ? formatDefaultDate(date.toDate())
    : date.format(dateFormat);
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
