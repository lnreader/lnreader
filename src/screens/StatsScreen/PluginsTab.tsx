import React, { useMemo } from 'react';

import type { NovelWithGenres } from '@database/queries/StatsQueries';
import { getString } from '@i18n/translations';
import { getPlugin } from '@plugins/pluginManager';
import {
  NovelCarousel,
  type StatsNovel,
} from '@screens/GenreStatsScreen/components';
import { ThemeColors } from '@theme/types';
import { DistributionCard, PluginSection } from './components';
import { StatsList } from './components/StatsCard';

interface PluginsTabProps {
  allNovels: NovelWithGenres[];
  theme: ThemeColors;
  onNovelPress: (novel: StatsNovel) => void;
}

export const PluginsTab: React.FC<PluginsTabProps> = ({
  allNovels,
  onNovelPress,
}) => {
  const rows = useMemo(() => {
    const byId = new Map(allNovels.map(novel => [novel.id, novel]));
    const groups = new Map<string, number[]>();
    for (const novel of allNovels) {
      groups.set(novel.pluginId, [
        ...(groups.get(novel.pluginId) ?? []),
        novel.id,
      ]);
    }
    const plugins = [...groups.entries()]
      .map(([pluginId, ids]) => ({
        pluginId,
        name: getPlugin(pluginId)?.name ?? pluginId,
        novels: ids
          .map(id => byId.get(id))
          .filter((novel): novel is NovelWithGenres => novel !== undefined)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => b.novels.length - a.novels.length);
    return [
      {
        key: 'plugin-distribution',
        render: () => (
          <DistributionCard
            title={getString('statsScreen.pluginDistribution')}
            centerLabel={getString('statsScreen.plugins')}
            entries={plugins.map(plugin => ({
              key: plugin.name,
              value: plugin.novels.length,
            }))}
          />
        ),
      },
      ...plugins.map(plugin => ({
        key: `plugin-${plugin.pluginId}`,
        render: () => (
          <PluginSection title={plugin.name} count={plugin.novels.length}>
            <NovelCarousel novels={plugin.novels} onPress={onNovelPress} />
          </PluginSection>
        ),
      })),
    ];
  }, [allNovels, onNovelPress]);

  return <StatsList rows={rows} />;
};
