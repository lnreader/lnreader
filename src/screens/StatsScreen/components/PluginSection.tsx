import React, { useMemo } from 'react';
import {
  useRecyclingState,
  useAdaptiveRender,
} from '@legendapp/list/react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { NovelCoverImage } from '@components';
import AnimatedHeight from './AnimatedHeight';
import type { ThemeColors } from '@theme/types';
import type { NovelWithGenres } from '@database/queries/StatsQueries';

interface PluginSectionProps {
  pluginId: string;
  name: string;
  count: number;
  novels: NovelWithGenres[];
  theme: ThemeColors;
  onNovelPress: (novel: {
    id: number;
    name: string;
    path: string;
    cover: string | null;
    pluginId: string;
  }) => void;
}

const PluginSection: React.FC<PluginSectionProps> = ({
  pluginId,
  name,
  count,
  novels,
  theme,
  onNovelPress,
}) => {
  const [expanded, setExpanded] = useRecyclingState(false);
  const adaptiveRender = useAdaptiveRender();
  const pluginNovels = useMemo(
    () => novels.filter(n => n.pluginId === pluginId),
    [novels, pluginId],
  );

  return (
    <View>
      <Pressable
        onPress={() => setExpanded(e => !e)}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.header,
          { borderBottomColor: theme.outlineVariant },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text
          style={[styles.name, { color: theme.onSurface }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        <View style={styles.headerRight}>
          <Text style={[styles.count, { color: theme.onSurfaceVariant }]}>
            {count}
          </Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-down' : 'chevron-right'}
            color={theme.onSurfaceVariant}
            size={24}
          />
        </View>
      </Pressable>
      {adaptiveRender === 'light' ? null : (
        <AnimatedHeight expanded={expanded}>
          {pluginNovels.map(novel => (
            <Pressable
              key={novel.id}
              onPress={() => onNovelPress(novel)}
              style={styles.novelRow}
            >
              <NovelCoverImage
                uri={novel.cover}
                requestInit={undefined}
                theme={theme}
                iconSize={18}
                style={styles.novelCover}
                contentFit="cover"
              />
              <Text
                style={[styles.novelName, { color: theme.onSurface }]}
                numberOfLines={1}
              >
                {novel.name}
              </Text>
            </Pressable>
          ))}
        </AnimatedHeight>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  name: { fontWeight: '600', flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  count: { marginRight: 8 },
  novelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  novelCover: {
    width: 36,
    aspectRatio: 2 / 3,
    marginRight: 8,
    borderRadius: 4,
  },
  novelName: { flex: 1 },
});

export default PluginSection;
