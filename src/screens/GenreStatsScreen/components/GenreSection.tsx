import React from 'react';
import {
  useAdaptiveRender,
  useRecyclingState,
} from '@legendapp/list/react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { getString } from '@i18n/translations';
import GenreRow from './GenreRow';
import NovelCarousel from './NovelCarousel';
import AnimatedHeight from '@screens/StatsScreen/components/AnimatedHeight';
import type { ThemeColors } from '@theme/types';
import type { GenreTreeNode } from '../utils';
import type { NovelWithGenres } from '@database/queries/StatsQueries';

interface GenreSectionProps {
  node: GenreTreeNode; // the category node
  globalMax: number; // global bar scale max
  novels: NovelWithGenres[]; // ALL novels (filtered internally)
  theme: ThemeColors;
  onNovelPress: (novel: {
    id: number;
    name: string;
    path: string;
    cover: string | null;
    pluginId: string;
  }) => void;
}

const GenreSection: React.FC<GenreSectionProps> = ({
  node,
  globalMax,
  novels,
  theme,
  onNovelPress,
}) => {
  const [expanded, setExpanded] = useRecyclingState(false);
  const adaptiveRender = useAdaptiveRender();
  const hasChildren = node.children && node.children.length > 0;

  const categoryNovels = React.useMemo(
    () =>
      novels
        .filter(n => node.novelIds.includes(n.id))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [novels, node.novelIds],
  );

  const toggleExpand = () => setExpanded(e => !e);

  const accessibilityLabel = expanded
    ? `${node.name}, ${node.categoryTotal} novels, expanded`
    : `${node.name}, ${node.categoryTotal} novels, collapsed`;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggleExpand}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={({ pressed }) => [
          styles.headerRow,
          { borderBottomColor: theme.outlineVariant },
          pressed && { opacity: 0.7 },
        ]}
      >
        <View style={styles.headerLeft}>
          <Text
            style={[styles.headerName, { color: theme.onSurface }]}
            numberOfLines={2}
          >
            {node.name}
          </Text>
          {!expanded && hasChildren && (
            <Text style={[styles.subtitle, { color: theme.onSurfaceVariant }]}>
              {getString('genreStats.subgenres', {
                count: node.children!.length,
              })}
            </Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.headerCount, { color: theme.onSurfaceVariant }]}>
            {node.categoryTotal}
          </Text>
          <MaterialCommunityIcons
            name={expanded ? 'chevron-down' : 'chevron-right'}
            color={theme.onSurfaceVariant}
            size={24}
          />
        </View>
      </Pressable>

      {adaptiveRender === 'light' ? null : (
        <AnimatedHeight key={node.name + '-colapse'} expanded={expanded}>
          {hasChildren &&
            node.children!.map(child => (
              <GenreRow
                key={child.name}
                name={child.name}
                count={child.count}
                maxCount={globalMax}
                theme={theme}
                isChild
              />
            ))}
          {hasChildren && <View style={styles.separator} />}
          <NovelCarousel
            novels={categoryNovels}
            genreName={node.name}
            theme={theme}
            onNovelPress={onNovelPress}
          />
          <View style={{ height: 20 }} />
        </AnimatedHeight>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  headerName: {
    fontWeight: '600',
    fontSize: 16,
  },
  subtitle: {
    fontSize: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerCount: {
    fontSize: 16,
  },
  expandedContent: {
    paddingTop: 8,
  },
  separator: {
    height: 8,
  },
});

export default GenreSection;
