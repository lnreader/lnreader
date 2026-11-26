import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import dayjs from 'dayjs';
import { IconButton } from 'react-native-paper';

import { getString } from '@i18n/translations';
import type { ThemeColors } from '@theme/types';
import { type Day, startOfLocalDay } from '@services/updates/releaseSchedule';
import { monthWeeks } from '../upcomingUtils';

const MAX_DOTS = 3;

interface UpcomingCalendarProps {
  /** First day of the month shown. */
  month: Day;
  today: Day;
  countByDay: Map<Day, number>;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onDayPress: (day: Day) => void;
  theme: ThemeColors;
}

const weekStart = () => dayjs.Ls[dayjs.locale()]?.weekStart ?? 0;

const UpcomingCalendar = ({
  month,
  today,
  countByDay,
  onPreviousMonth,
  onNextMonth,
  onDayPress,
  theme,
}: UpcomingCalendarProps) => {
  const start = weekStart();
  const weeks = useMemo(() => monthWeeks(month, start), [month, start]);
  const weekdays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        dayjs()
          .day((start + i) % 7)
          .format('dd'),
      ),
    [start],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.monthTitle, { color: theme.onSurface }]}>
          {dayjs(startOfLocalDay(month)).format('MMMM YYYY')}
        </Text>
        <IconButton
          icon="chevron-left"
          iconColor={theme.onSurface}
          accessibilityLabel={getString('upcomingScreen.previousMonth')}
          onPress={onPreviousMonth}
        />
        <IconButton
          icon="chevron-right"
          iconColor={theme.onSurface}
          accessibilityLabel={getString('upcomingScreen.nextMonth')}
          onPress={onNextMonth}
        />
      </View>
      <View style={styles.week}>
        {weekdays.map((label, i) => (
          <Text
            key={i}
            style={[styles.weekday, { color: theme.onSurfaceVariant }]}
          >
            {label}
          </Text>
        ))}
      </View>
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.week}>
          {week.map((day, i) => {
            if (day === null) {
              return <View key={i} style={styles.cell} />;
            }
            const count = countByDay.get(day) ?? 0;
            const isToday = day === today;
            return (
              <Pressable
                key={i}
                testID={`upcoming-day-${day}`}
                accessibilityRole="button"
                accessibilityState={{ disabled: !count }}
                disabled={!count}
                onPress={() => onDayPress(day)}
                style={styles.cell}
                android_ripple={{ color: theme.rippleColor, borderless: true }}
              >
                <View
                  style={[
                    styles.dayNumber,
                    isToday && { backgroundColor: theme.primary },
                  ]}
                >
                  <Text
                    style={{
                      color: isToday
                        ? theme.onPrimary
                        : count
                        ? theme.onSurface
                        : theme.onSurfaceVariant,
                    }}
                  >
                    {dayjs(startOfLocalDay(day)).format('D')}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {Array.from({ length: Math.min(count, MAX_DOTS) }, (_, d) => (
                    <View
                      key={d}
                      style={[styles.dot, { backgroundColor: theme.primary }]}
                    />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
};

export default memo(UpcomingCalendar);

const styles = StyleSheet.create({
  cell: {
    alignItems: 'center',
    flex: 1,
    height: 48,
    justifyContent: 'center',
  },
  container: {
    paddingBottom: 8,
    paddingHorizontal: 8,
  },
  dayNumber: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dot: {
    borderRadius: 2,
    height: 4,
    width: 4,
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
    marginTop: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingLeft: 8,
  },
  monthTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
  },
  week: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    fontSize: 12,
    paddingVertical: 8,
    textAlign: 'center',
  },
});
