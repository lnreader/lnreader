import React from 'react';

import { getString } from '@i18n/translations';
import PluginSection from '@screens/StatsScreen/components/PluginSection';
import type { GenreTreeNode } from '../utils';
import GenreRow from './GenreRow';
import NovelCarousel, { type StatsNovel } from './NovelCarousel';

interface GenreSectionProps {
  node: GenreTreeNode;
  globalMax: number; // global bar scale max
  novels: readonly StatsNovel[];
  onNovelPress: (novel: StatsNovel) => void;
}

const GenreSection: React.FC<GenreSectionProps> = ({
  node,
  globalMax,
  novels,
  onNovelPress,
}) => (
  <PluginSection
    title={node.name}
    count={node.categoryTotal}
    subtitle={
      node.children?.length
        ? getString('genreStats.subgenres', { count: node.children.length })
        : undefined
    }
  >
    {node.children?.map(child => (
      <GenreRow
        key={child.name}
        name={child.name}
        count={child.count}
        maxCount={globalMax}
      />
    ))}
    <NovelCarousel novels={novels} onPress={onNovelPress} />
  </PluginSection>
);

export default GenreSection;
