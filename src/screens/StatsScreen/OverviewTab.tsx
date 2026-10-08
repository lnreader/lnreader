import React, { useMemo } from 'react';
import { Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { NavigationProp } from '@react-navigation/native';

import { AppText, Button, RNContent } from '@components';
import type { NovelWithGenres } from '@database/queries/StatsQueries';
import { LibraryStats } from '@database/types';
import { useGenreTaxonomy } from '@hooks/persisted/useGenreTaxonomy';
import { getString } from '@i18n/translations';
import { MoreStackParamList } from '@navigators/types';
import { buildGenreTree } from '@screens/GenreStatsScreen/utils';
import {
  GenreSection,
  type StatsNovel,
} from '@screens/GenreStatsScreen/components';
import { ThemeColors } from '@theme/types';
import { translateNovelStatus } from '@utils/translateEnum';
import TuneIcon from '@expo/material-symbols/tune.xml';
import { ChapterBar, DistributionCard, StatsCard } from './components';
import { StatsList, useCardRows } from './components/StatsCard';

interface OverviewTabProps {
  allNovels: NovelWithGenres[];
  stats: LibraryStats;
  theme: ThemeColors;
  onNovelPress: (novel: StatsNovel) => void;
  navigation: NavigationProp<MoreStackParamList>;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  allNovels,
  stats,
  onNovelPress,
  navigation,
}) => {
  const { taxonomy } = useGenreTaxonomy();
  const cardRows = useCardRows();

  const rows = useMemo(() => {
    const byId = new Map(allNovels.map(novel => [novel.id, novel]));
    const novelsFor = (ids: readonly number[]) =>
      ids
        .map(id => byId.get(id))
        .filter((novel): novel is NovelWithGenres => novel !== undefined)
        .sort((a, b) => a.name.localeCompare(b.name));
    const tree = buildGenreTree(allNovels, taxonomy);
    const max = Math.max(
      1,
      ...tree.flatMap(node => [
        node.count,
        ...(node.children?.map(child => child.count) ?? []),
      ]),
    );
    return [
      ...cardRows([
        {
          key: 'chapters',
          render: () => (
            <StatsCard>
              <RNContent>
                <ChapterBar
                  read={stats.chaptersRead ?? 0}
                  total={stats.chaptersCount ?? 0}
                  downloaded={stats.chaptersDownloaded ?? 0}
                />
              </RNContent>
            </StatsCard>
          ),
        },
        {
          key: 'status',
          render: () => (
            <DistributionCard
              title={getString('statsScreen.statusDistribution')}
              centerLabel={getString('statsScreen.novels')}
              entries={Object.entries(stats.status ?? {}).map(
                ([key, value]) => ({ key, value }),
              )}
              getLabel={translateNovelStatus}
            />
          ),
        },
      ]),
      ...(tree.length
        ? [
            {
              key: 'genres-header',
              render: () => (
                <Row
                  verticalAlignment="center"
                  modifiers={[fillMaxWidth(), padding(0, 12, 0, 0)]}
                >
                  <AppText variant="titleMedium" modifiers={[weight(1)]}>
                    {getString('statsScreen.genreDistribution')}
                  </AppText>
                  <Button
                    mode="text"
                    icon={TuneIcon}
                    title={getString('statsScreen.customizeGenres')}
                    onPress={() =>
                      navigation.navigate('SettingsStack', {
                        screen: 'GenreTaxonomy',
                      })
                    }
                  />
                </Row>
              ),
            },
          ]
        : []),
      ...tree.map(node => ({
        key: `genre-${node.name}`,
        render: () => (
          <GenreSection
            node={node}
            globalMax={max}
            novels={novelsFor(node.novelIds)}
            onNovelPress={onNovelPress}
          />
        ),
      })),
    ];
  }, [allNovels, cardRows, navigation, onNovelPress, stats, taxonomy]);

  return <StatsList rows={rows} />;
};
