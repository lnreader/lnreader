import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';
import { IconButton } from 'react-native-paper';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

import { getString } from '@i18n/translations';

import { NovelCoverImage } from '@components';

import { getPlugin } from '@plugins/pluginManager';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { formatTimeSpent } from './utils';

import type { ThemeColors } from '@theme/types';
import type { LibraryStats } from '@database/types';

dayjs.extend(duration);

type TimeSpentItem =
  | {
      type: 'novel';
      id: number;
      pluginId: string;
      name: string;
      cover: string | null;
      timeSpent: number;
    }
  | { type: 'category'; id: number; name: string; timeSpent: number };

interface TimeTabProps {
  stats: LibraryStats;
  theme: ThemeColors;
}

function formatTotalTimeParts(totalMs: number | undefined) {
  if (!totalMs || totalMs <= 0) return null;
  const d = dayjs.duration(totalMs, 'milliseconds');
  const days = Math.floor(d.asDays());
  const hours = d.hours();
  const minutes = d.minutes();

  return { days, hours, minutes };
}

export const TimeTab: React.FC<TimeTabProps> = ({ stats, theme }) => {
  const [showingNovels, setShowingNovels] = useState(true);

  const timeSpentData = useMemo<TimeSpentItem[]>(() => {
    if (showingNovels) {
      return (stats.topNovelsByTimeSpent ?? []).map(n => ({
        type: 'novel' as const,
        id: n.id,
        pluginId: n.pluginId,
        name: n.name,
        cover: n.cover,
        timeSpent: n.timeSpent,
      }));
    }
    return (stats.topCategoriesByTimeSpent ?? []).map(c => ({
      type: 'category' as const,
      id: c.id,
      name: c.name,
      timeSpent: c.timeSpent,
    }));
  }, [
    showingNovels,
    stats.topNovelsByTimeSpent,
    stats.topCategoriesByTimeSpent,
  ]);

  const renderTimeItem = useCallback(
    ({ item }: { item: TimeSpentItem }) => {
      if (item.type === 'novel') {
        const plugin = getPlugin(item.pluginId);
        const headers = plugin?.imageRequestInit?.headers || {
          'User-Agent': getUserAgent(),
        };
        const requestInit = { ...plugin?.imageRequestInit, headers };
        return (
          <View style={styles.timeSpentRow}>
            <NovelCoverImage
              uri={item.cover}
              requestInit={requestInit}
              theme={theme}
              iconSize={22}
              style={styles.timeSpentNovelCover}
              contentFit="cover"
            />
            <View>
              <Text style={[styles.timeSpentLabel, { color: theme.onSurface }]}>
                {item.name}
              </Text>
              <Text style={{ color: theme.onSurfaceVariant }}>
                {formatTimeSpent(item.timeSpent)}
              </Text>
            </View>
          </View>
        );
      }
      return (
        <View style={styles.timeSpentRow}>
          <View>
            <Text style={[styles.timeSpentLabel, { color: theme.onSurface }]}>
              {item.name}
            </Text>
            <Text style={{ color: theme.onSurfaceVariant }}>
              {formatTimeSpent(item.timeSpent)}
            </Text>
          </View>
        </View>
      );
    },
    [theme],
  );

  const totalTimeParts = formatTotalTimeParts(stats.totalTimeSpent);

  const formatTwoNumbers = (timeSpent: number) =>
    timeSpent <= 9 ? `0${timeSpent}` : timeSpent;

  const timeListHeader = useCallback(
    () => (
      <>
        <View style={styles.totalTimeContainer}>
          <Text
            style={[styles.totalTimeLabel, { color: theme.onSurfaceVariant }]}
          >
            {getString('statsScreen.totalTimeSpent')}
          </Text>
          {totalTimeParts ? (
            <View style={styles.totalTimeValueRow}>
              {totalTimeParts.days > 0 && (
                <View style={styles.totalTimeBlock}>
                  <Text
                    style={[styles.totalTimeNumber, { color: theme.primary }]}
                  >
                    {formatTwoNumbers(totalTimeParts.days)}
                  </Text>
                  <Text
                    style={[
                      styles.totalTimeUnit,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    {getString('time.days', { count: totalTimeParts.days })
                      .replace(/\d+/, '')
                      .trim()}
                  </Text>
                </View>
              )}
              {totalTimeParts.hours > 0 && (
                <View style={styles.totalTimeBlock}>
                  <Text
                    style={[styles.totalTimeNumber, { color: theme.primary }]}
                  >
                    {formatTwoNumbers(totalTimeParts.hours)}
                  </Text>
                  <Text
                    style={[
                      styles.totalTimeUnit,
                      { color: theme.onSurfaceVariant },
                    ]}
                  >
                    {getString('time.hours', { count: totalTimeParts.hours })
                      .replace(/\d+/, '')
                      .trim()}
                  </Text>
                </View>
              )}
              <View style={styles.totalTimeBlock}>
                <Text
                  style={[styles.totalTimeNumber, { color: theme.primary }]}
                >
                  {formatTwoNumbers(totalTimeParts.minutes)}
                </Text>
                <Text
                  style={[
                    styles.totalTimeUnit,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  {getString('time.minutes', {
                    count: totalTimeParts.minutes,
                  })
                    .replace(/\d+/, '')
                    .trim()}
                </Text>
              </View>
            </View>
          ) : (
            <Text
              style={[styles.totalTimeEmpty, { color: theme.onSurfaceVariant }]}
            >
              {formatTimeSpent(stats.totalTimeSpent)}
            </Text>
          )}
        </View>
        <View style={styles.timeSpentHeader}>
          <Text style={[styles.header, { color: theme.onSurfaceVariant }]}>
            {showingNovels
              ? getString('statsScreen.topNovelsByTimeSpent')
              : getString('statsScreen.topCategoriesByTimeSpent')}
          </Text>
          <IconButton
            icon={showingNovels ? 'label-outline' : 'book'}
            iconColor={theme.onSurfaceVariant}
            onPress={() => setShowingNovels(!showingNovels)}
            accessibilityRole="button"
            accessibilityLabel={
              showingNovels
                ? getString('statsScreen.showCategories')
                : getString('statsScreen.showNovels')
            }
          />
        </View>
      </>
    ),
    [stats.totalTimeSpent, theme, showingNovels, totalTimeParts],
  );

  return (
    <LegendList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={timeSpentData}
      estimatedItemSize={56}
      getItemType={item => item.type}
      keyExtractor={item => `${item.type}-${item.id}`}
      ListHeaderComponent={timeListHeader}
      recycleItems
      renderItem={renderTimeItem}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 16,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  totalTimeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  totalTimeLabel: {
    fontSize: 14,
    marginBottom: 12,
  },
  totalTimeValueRow: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-end',
  },
  totalTimeBlock: {
    alignItems: 'center',
  },
  totalTimeNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 38,
  },
  totalTimeUnit: {
    fontSize: 12,
    marginTop: 2,
  },
  totalTimeEmpty: {
    fontSize: 16,
  },
  timeSpentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSpentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeSpentNovelCover: {
    width: 50,
    aspectRatio: 2 / 3,
    marginRight: 8,
    borderRadius: 4,
  },
  timeSpentLabel: {
    fontWeight: 'bold',
  },
  header: {
    fontWeight: 'bold',
    paddingVertical: 16,
  },
});
