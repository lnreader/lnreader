import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

import {
  Appbar,
  ErrorScreenV2,
  LoadingScreenV2,
  NovelCoverImage,
  SafeAreaView,
} from '@components';

import { LibraryStats } from '@database/types';
import {
  getChaptersDownloadedCountFromDb,
  getChaptersReadCountFromDb,
  getChaptersTotalCountFromDb,
  getChaptersUnreadCountFromDb,
  getLibraryStatsFromDb,
  getNovelGenresFromDb,
  getNovelStatusFromDb,
  getTopCategoriesByTimeSpentFromDb,
  getTopNovelsByTimeSpentFromDb,
  getTotalTimeSpentFromDb,
} from '@database/queries/StatsQueries';
import { Row } from '@components/Common';
import { IconButton, overlay } from 'react-native-paper';
import { translateNovelStatus } from '@utils/translateEnum';
import dayjs from 'dayjs';
import { getUserAgent } from '@hooks/persisted/useUserAgent';
import { getPlugin } from '@plugins/pluginManager';

function formatTimeSpent(totalMs: number | undefined) {
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
        ? `${getString('time.days', { count: asDays })} ${getString('time.hours', { count: hours })}`
        : getString('time.days', { count: asDays });
  }
  if (asHours >= 1) {
      return minutes > 0
          ? `${getString('time.hours', { count: asHours })} ${getString('time.minutes', { count: minutes })}`
          : getString('time.hours', { count: asHours });
  }
  if (asMinutes >= 1) {
    return seconds > 0
      ? `${getString('time.minutes', { count: asMinutes })} ${getString('time.seconds', { count: seconds })}`
      : getString('time.minutes', { count: asMinutes });
  }
  return getString('time.seconds', { count: asSeconds });
}

const StatsScreen = () => {
  const theme = useTheme();
  const { goBack } = useNavigation();

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<LibraryStats>({});
  const [error, setError] = useState<unknown>();

  const [showingNovels, setShowingNovels] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const res = await Promise.all([
          getLibraryStatsFromDb(),
          getChaptersTotalCountFromDb(),
          getChaptersReadCountFromDb(),
          getChaptersUnreadCountFromDb(),
          getChaptersDownloadedCountFromDb(),
          getNovelGenresFromDb(),
          getNovelStatusFromDb(),
          getTopNovelsByTimeSpentFromDb(),
          getTopCategoriesByTimeSpentFromDb(),
          getTotalTimeSpentFromDb(),
        ]);

        if (!cancelled) {
          setStats(
            res.reduce<LibraryStats>(
              (combinedStats, currentStats) => ({
                ...combinedStats,
                ...currentStats,
              }),
              {},
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, []);

  const Header = (
    <Appbar
      title={getString('statsScreen.title')}
      handleGoBack={goBack}
      theme={theme}
    />
  );

  if (error) {
    return (
      <>
        {Header}
        <ErrorScreenV2 error={error} />
      </>
    );
  }
  if (isLoading) {
    return (
      <>
        {Header}
        <LoadingScreenV2 theme={theme} />
      </>
    );
  }

  return (
    <SafeAreaView excludeTop>
      {Header}
      <ScrollView
        style={styles.screenCtn}
        contentContainerStyle={styles.contentCtn}
      >
        <Text style={[styles.header, { color: theme.onSurfaceVariant }]}>
          {getString('generalSettings')}
        </Text>
        <Row style={styles.statsRow}>
          <StatsCard
            label={getString('statsScreen.titlesInLibrary')}
            value={stats.novelsCount}
          />
          <StatsCard
            label={getString('statsScreen.totalTimeSpent')}
            value={formatTimeSpent(stats.totalTimeSpent)}
          />
        </Row>
        <Row style={styles.statsRow}>
          <StatsCard
            label={getString('statsScreen.readChapters')}
            value={stats.chaptersRead}
          />
          <StatsCard
            label={getString('statsScreen.totalChapters')}
            value={stats.chaptersCount}
          />
        </Row>
        <Row style={styles.statsRow}>
          <StatsCard
            label={getString('statsScreen.unreadChapters')}
            value={stats.chaptersUnread}
          />
          <StatsCard
            label={getString('statsScreen.downloadedChapters')}
            value={stats.chaptersDownloaded}
          />
        </Row>
        <Row style={styles.statsRow}>
          <StatsCard
            label={getString('statsScreen.sources')}
            value={stats.sourcesCount}
          />
        </Row>
        <Text style={[styles.header, { color: theme.onSurfaceVariant }]}>
          {getString('statsScreen.genreDistribution')}
        </Text>
        <Row style={[styles.statsRow, styles.genreRow]}>
          {Object.entries(stats.genres || {}).map(item => (
            <StatsCard key={item[0]} label={item[0]} value={item[1]} />
          ))}
        </Row>
        <Text style={[styles.header, { color: theme.onSurfaceVariant }]}>
          {getString('statsScreen.statusDistribution')}
        </Text>
        <Row style={[styles.statsRow, styles.genreRow]}>
          {Object.entries(stats.status || {}).map(item => (
            <StatsCard
              key={item[0]}
              label={translateNovelStatus(item[0])}
              value={item[1]}
            />
          ))}
        </Row>
      <View style={styles.timeSpentHeader}>
        <Text style={[styles.header, { color: theme.onSurfaceVariant }]}>
          {showingNovels ? getString('statsScreen.topNovelsByTimeSpent') : getString('statsScreen.topCategoriesByTimeSpent')}
        </Text>
        <IconButton
          icon={showingNovels ? 'label-outline' : 'book'}
          iconColor={theme.onSurfaceVariant}
          onPress={() => setShowingNovels(!showingNovels)}
          accessibilityRole="button"
          accessibilityLabel={showingNovels ? getString('statsScreen.showCategories') : getString('statsScreen.showNovels')}
          />
      </View>
        {showingNovels && stats.topNovelsByTimeSpent?.map((novel, _) => {
          const plugin = getPlugin(novel.pluginId);
          const headers = plugin?.imageRequestInit?.headers || { 'User-Agent': getUserAgent() };
          const requestInit = {...plugin?.imageRequestInit, headers };
          return <View key={novel.id} style={styles.timeSpentRow}>
            <NovelCoverImage
              uri={novel.cover}
              requestInit={requestInit}
              theme={theme}
              iconSize={22}
              style={styles.timeSpentNovelCover}
              contentFit='cover'
            />
            <View>
              <Text style={[styles.timeSpentLabel, { color: theme.onSurface }]}>
                {novel.name}
              </Text>
              <Text style={{ color: theme.onSurfaceVariant }}>
                {formatTimeSpent(novel.timeSpent)}
              </Text>
            </View>
          </View>
        })}
        {!showingNovels && stats.topCategoriesByTimeSpent?.map((category, _) => {
          return <View key={category.id} style={styles.timeSpentRow}>
            <View>
              <Text style={[styles.timeSpentLabel, { color: theme.onSurface }]}>
                {category.name}
              </Text>
              <Text style={{ color: theme.onSurfaceVariant }}>
                {formatTimeSpent(category.timeSpent)}
              </Text>
            </View>
          </View>
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

export default StatsScreen;

export const StatsCard: React.FC<{ label: string; value?: string | number }> = ({
  label,
  value = 0,
}) => {
  const theme = useTheme();

  if (!label) {
    return null;
  }

  return (
    <View
      style={[
        styles.statsCardCtn,
        {
          backgroundColor: theme.isDark
            ? overlay(2, theme.surface)
            : theme.secondaryContainer,
        },
      ]}
    >
      <Text style={[styles.statsVal, { color: theme.primary }]}>{value}</Text>
      <Text style={{ color: theme.onSurface }}> {label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  contentCtn: {
    paddingBottom: 40,
  },
  genreRow: {
    flexWrap: 'wrap',
  },
  header: {
    fontWeight: 'bold',
    paddingVertical: 16,
  },
  screenCtn: {
    paddingHorizontal: 16,
  },
  statsCardCtn: {
    alignItems: 'center',
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    margin: 4,
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  statsRow: {
    justifyContent: 'center',
    marginBottom: 8,
  },
  statsVal: {
    fontSize: 16,
    fontWeight: 'bold',
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
});
