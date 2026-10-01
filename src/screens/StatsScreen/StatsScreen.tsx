import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

import {
  Appbar,
  ErrorScreenV2,
  LoadingScreenV2,
  Screen,
  TabPager,
} from '@components';

import countBy from 'lodash-es/countBy';
import { LibraryStats } from '@database/types';
import {
  getAggregateStatsFromDb,
  getTopCategoriesByTimeSpentFromDb,
  getTopNovelsByTimeSpentFromDb,
  getNovelsWithGenresFromDb,
  type NovelWithGenres,
} from '@database/queries/StatsQueries';
import type { StatsNovel } from '@screens/GenreStatsScreen/components';
import { OverviewTab } from './OverviewTab';
import { PluginsTab } from './PluginsTab';
import { TimeTab } from './TimeTab';

type StatsRoute = {
  key: 'overview' | 'plugins' | 'time';
  title: string;
};

const StatsScreen = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<LibraryStats>({});
  const [error, setError] = useState<unknown>();
  const [allNovels, setAllNovels] = useState<NovelWithGenres[]>([]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadStats = async () => {
      try {
        const [aggregateStats, topNovels, topCategories, novelsWithGenres] =
          await Promise.all([
            getAggregateStatsFromDb(),
            getTopNovelsByTimeSpentFromDb(),
            getTopCategoriesByTimeSpentFromDb(),
            getNovelsWithGenresFromDb(),
          ]);

        if (!cancelled) {
          const allGenres: string[] = [];
          const statusMap: Record<string, number> = {};
          for (const n of novelsWithGenres) {
            if (n.genres) {
              allGenres.push(...n.genres.split(/\s*,\s*/));
            }
            const s = n.status?.trim() || 'Unknown';
            statusMap[s] = (statusMap[s] ?? 0) + 1;
          }
          const genres = countBy(allGenres);

          setStats({
            ...aggregateStats,
            ...topNovels,
            ...topCategories,
            genres,
            status: statusMap,
          });
        }
        if (!cancelled) setAllNovels(novelsWithGenres);
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

  const handleNovelPress = useCallback(
    (novel: StatsNovel) => {
      navigation.navigate('ReaderStack', {
        screen: 'Novel',
        params: {
          name: novel.name,
          path: novel.path,
          pluginId: novel.pluginId,
          cover: novel.cover,
        },
      });
    },
    [navigation],
  );

  const routes: StatsRoute[] = useMemo(
    () => [
      { key: 'overview', title: getString('generalSettings') },
      { key: 'plugins', title: getString('statsScreen.plugins') },
      { key: 'time', title: getString('statsScreen.readingTime') },
    ],
    [],
  );

  const tabs = useMemo(
    () => routes.map((route, i) => ({ key: i, label: route.title })),
    [routes],
  );

  const renderScene = useCallback(
    ({ route: tabRoute }: { route: StatsRoute }) => {
      switch (tabRoute.key) {
        case 'overview':
          return (
            <OverviewTab
              allNovels={allNovels}
              stats={stats}
              theme={theme}
              onNovelPress={handleNovelPress}
              navigation={navigation}
            />
          );
        case 'plugins':
          return (
            <PluginsTab
              allNovels={allNovels}
              theme={theme}
              onNovelPress={handleNovelPress}
            />
          );
        case 'time':
          return <TimeTab stats={stats} theme={theme} />;
      }
    },
    [allNovels, stats, theme, handleNovelPress, navigation],
  );

  const Header = (
    <Appbar
      title={getString('statsScreen.title')}
      handleGoBack={navigation.goBack}
      theme={theme}
    />
  );

  if (error || isLoading) {
    return (
      <Screen topBar={Header}>
        {error ? (
          <ErrorScreenV2 error={error} />
        ) : (
          <LoadingScreenV2 theme={theme} />
        )}
      </Screen>
    );
  }

  return (
    <Screen
      topBar={Header}
      list={
        <TabPager
          tabs={tabs}
          index={index}
          onIndexChange={setIndex}
          renderPage={i => renderScene({ route: routes[i] })}
          fixed
        />
      }
    />
  );
};

export default StatsScreen;
