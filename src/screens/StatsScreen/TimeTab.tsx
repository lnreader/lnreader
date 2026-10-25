import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';

import { getString } from '@i18n/translations';

import { EmptyView, NovelCoverImage } from '@components';

import { getPlugin } from '@plugins/pluginManager';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { formatTimeSpent } from './utils';

import type { ThemeColors } from '@theme/types';
import type { LibraryStats } from '@database/types';

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
            <View style={styles.timeSpentText}>
              <Text style={[styles.timeSpentLabel, { color: theme.onSurface }]}>
                {item.name}
              </Text>
              <Text
                style={[
                  styles.timeSpentDetail,
                  { color: theme.onSurfaceVariant },
                ]}
              >
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
            <Text
              style={[
                styles.timeSpentDetail,
                { color: theme.onSurfaceVariant },
              ]}
            >
              {formatTimeSpent(item.timeSpent)}
            </Text>
          </View>
        </View>
      );
    },
    [theme],
  );

  const timeListHeader = useCallback(
    () => (
      <>
        <View style={styles.totalTimeContainer}>
          <Text style={[styles.totalTimeNumber, { color: theme.onSurface }]}>
            {formatTimeSpent(stats.totalTimeSpent)}
          </Text>
          <Text
            style={[styles.totalTimeLabel, { color: theme.onSurfaceVariant }]}
          >
            {getString('statsScreen.totalTimeSpent')}
          </Text>
        </View>
        <View style={styles.timeSpentHeader}>
          <Text style={[styles.header, { color: theme.onSurface }]}>
            {showingNovels
              ? getString('statsScreen.topNovelsByTimeSpent')
              : getString('statsScreen.topCategoriesByTimeSpent')}
          </Text>
          <Pressable
            onPress={() => setShowingNovels(!showingNovels)}
            accessibilityRole="button"
            accessibilityLabel={
              showingNovels
                ? getString('statsScreen.showCategories')
                : getString('statsScreen.showNovels')
            }
            style={[styles.toggleButton, { borderColor: theme.outlineVariant }]}
          >
            <Text style={[styles.toggleText, { color: theme.primary }]}>
              {showingNovels
                ? getString('statsScreen.showCategories')
                : getString('statsScreen.showNovels')}
            </Text>
          </Pressable>
        </View>
      </>
    ),
    [stats.totalTimeSpent, theme, showingNovels],
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
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <EmptyView
            icon="(˘･_･˘)"
            description={getString(
              showingNovels
                ? 'statsScreen.noNovelReadingTime'
                : 'statsScreen.noCategoryReadingTime',
            )}
            theme={theme}
          />
        </View>
      }
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
  emptyState: {
    paddingVertical: 24,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 40,
  },
  totalTimeContainer: {
    paddingTop: 4,
    paddingBottom: 24,
  },
  totalTimeLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  totalTimeNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  timeSpentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeSpentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    marginBottom: 8,
  },
  timeSpentNovelCover: {
    width: 40,
    aspectRatio: 2 / 3,
    marginRight: 12,
    borderRadius: 6,
  },
  timeSpentText: {
    flex: 1,
  },
  timeSpentLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeSpentDetail: {
    fontSize: 12,
    marginTop: 4,
  },
  header: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
