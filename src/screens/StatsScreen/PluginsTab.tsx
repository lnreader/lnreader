import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LegendList } from '@legendapp/list/react-native';

import { getString } from '@i18n/translations';

import { getPlugin } from '@plugins/pluginManager';

import {
  getDonutPalette,
  DonutChartWithLegend,
  PluginSection,
} from './components';

import type { ThemeColors } from '@theme/types';
import type { NovelWithGenres } from '@database/queries/StatsQueries';

interface PluginsTabProps {
  allNovels: NovelWithGenres[];
  theme: ThemeColors;
  onNovelPress: (novel: {
    id: number;
    name: string;
    path: string;
    cover: string | null;
    pluginId: string;
  }) => void;
}

export const PluginsTab: React.FC<PluginsTabProps> = ({
  allNovels,
  theme,
  onNovelPress,
}) => {
  const pluginData = useMemo(() => {
    const groups = new Map<
      string,
      { name: string; count: number; novelIds: number[] }
    >();
    for (const novel of allNovels) {
      const plugin = getPlugin(novel.pluginId);
      const name = plugin?.name ?? novel.pluginId;
      const group = groups.get(novel.pluginId);
      if (group) {
        group.novelIds.push(novel.id);
        group.count++;
      } else {
        groups.set(novel.pluginId, { name, count: 1, novelIds: [novel.id] });
      }
    }
    const nodes = Array.from(groups.entries())
      .map(([pluginId, data]) => ({
        pluginId,
        name: data.name,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count);
    const keys = nodes.map(n => n.name);
    const colors = getDonutPalette(keys, theme);
    const donutEntries = nodes.map(n => ({ key: n.name, value: n.count }));
    return { nodes, colors, donutEntries };
  }, [allNovels, theme]);

  const renderPluginItem = useCallback(
    ({ item }: { item: { pluginId: string; name: string; count: number } }) => (
      <PluginSection
        pluginId={item.pluginId}
        name={item.name}
        count={item.count}
        novels={allNovels}
        theme={theme}
        onNovelPress={onNovelPress}
      />
    ),
    [allNovels, theme, onNovelPress],
  );

  const { donutEntries, colors: pluginColors } = pluginData;
  const pluginListHeader = useCallback(
    () => (
      <View>
        <DonutChartWithLegend
          title={getString('statsScreen.pluginDistribution')}
          entries={donutEntries}
          colors={pluginColors}
          theme={theme}
          centerLabel={getString('statsScreen.plugins')}
        />
      </View>
    ),
    [donutEntries, pluginColors, theme],
  );

  return (
    <LegendList
      style={styles.list}
      contentContainerStyle={styles.listContent}
      data={pluginData.nodes}
      estimatedItemSize={56}
      keyExtractor={item => item.pluginId}
      getItemType={() => 'plugin'}
      ListHeaderComponent={pluginListHeader}
      renderItem={renderPluginItem}
      recycleItems
      showsVerticalScrollIndicator={false}
      experimental_adaptiveRender={{ initialMode: 'light' }}
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
});
