import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import NovelCoverImage from '@components/NovelCoverImage';
import type { ThemeColors } from '@theme/types';

interface NovelCardProps {
  novel: { id: number; name: string; cover: string | null; pluginId: string };
  theme: ThemeColors;
  onPress: () => void;
}

const NovelCard: React.FC<NovelCardProps> = React.memo(
  ({ novel, theme, onPress }) => {
    return (
      <Pressable
        onPress={onPress}
        accessibilityLabel={`${novel.name}, novel`}
        accessibilityRole="button"
        style={styles.card}
      >
        <NovelCoverImage
          uri={novel.cover}
          theme={theme}
          iconSize={20}
          style={styles.cover}
          contentFit="cover"
        />
        <Text
          style={[styles.title, { color: theme.onSurface }]}
          numberOfLines={1}
        >
          {novel.name}
        </Text>
      </Pressable>
    );
  },
  (prev, next) => prev.novel.id === next.novel.id,
);

const styles = StyleSheet.create({
  card: {
    width: 80,
    marginRight: 8,
  },
  cover: {
    width: 80,
    aspectRatio: 2 / 3,
    borderRadius: 4,
  },
  title: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default NovelCard;
