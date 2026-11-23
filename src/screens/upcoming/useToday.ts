import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  type Day,
  startOfLocalDay,
  toLocalDay,
} from '@services/updates/releaseSchedule';

/** Today's local day, kept current across focus, app resumes and midnight. */
export const useToday = (): Day => {
  const [today, setToday] = useState(() => toLocalDay(new Date()));
  const refresh = useCallback(() => setToday(toLocalDay(new Date())), []);

  useFocusEffect(refresh);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  useEffect(() => {
    const untilMidnight = startOfLocalDay(today + 1).getTime() - Date.now();
    // A second past midnight, so the new day has started on every clock
    const timer = setTimeout(refresh, Math.max(untilMidnight, 0) + 1000);
    return () => clearTimeout(timer);
  }, [refresh, today]);

  return today;
};
