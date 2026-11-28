import { getString } from '@i18n/translations';
import dayjs from 'dayjs';

export function formatTimeSpent(totalMs: number | undefined) {
  if (totalMs === undefined || totalMs <= 0) {
    return getString('time.seconds', { count: 0 });
  }
  const d = dayjs.duration(totalMs, 'milliseconds');
  const asDays = Math.floor(d.asDays());
  const asHours = Math.floor(d.asHours());
  const asMinutes = Math.floor(d.asMinutes());
  const asSeconds = Math.floor(d.asSeconds());
  const hours = Math.floor(d.hours());
  const minutes = Math.floor(d.minutes());
  const seconds = Math.floor(d.seconds());

  if (asDays >= 1) {
    return hours > 0
      ? `${getString('time.days', { count: asDays })} ${getString(
          'time.hours',
          { count: hours },
        )}`
      : getString('time.days', { count: asDays });
  }
  if (asHours >= 1) {
    return minutes > 0
      ? `${getString('time.hours', { count: asHours })} ${getString(
          'time.minutes',
          { count: minutes },
        )}`
      : getString('time.hours', { count: asHours });
  }
  if (asMinutes >= 1) {
    return seconds > 0
      ? `${getString('time.minutes', { count: asMinutes })} ${getString(
          'time.seconds',
          { count: seconds },
        )}`
      : getString('time.minutes', { count: asMinutes });
  }
  return getString('time.seconds', { count: asSeconds });
}
