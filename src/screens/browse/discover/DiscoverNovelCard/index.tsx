import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { NovelCoverImage } from '@components';
import { ThemeColors } from '@theme/types';

interface Props {
  novel: {
    novelName: string;
    novelCover: string;
    score: string;
    info: string[];
  };
  onPress: () => void;
  theme: ThemeColors;
}

const DiscoverNovelCard: React.FC<Props> = ({ novel, onPress, theme }) => {
  return (
    <View style={[styles.container, { backgroundColor: theme.overlay3 }]}>
      <Pressable
        style={styles.pressable}
        onPress={onPress}
        android_ripple={{ color: theme.rippleColor }}
      >
        <NovelCoverImage
          uri={novel.novelCover}
          theme={theme}
          iconSize={32}
          style={styles.cover}
        />
        <View style={styles.infoContainer}>
          <Text
            style={[styles.title, { color: theme.onSurface }]}
            numberOfLines={2}
          >
            {novel.novelName}
          </Text>
          <Text style={[styles.small, { color: theme.onSurface }]}>
            Score:{' '}
            <Text style={{ color: theme.onSurfaceVariant }}>{novel.score}</Text>
          </Text>
          {novel?.info?.[1] ? (
            <Text style={[styles.small, { color: theme.onSurface }]}>
              Type:{' '}
              <Text style={{ color: theme.onSurfaceVariant }}>
                {novel.info[1]}
              </Text>
            </Text>
          ) : null}
          {novel?.info?.[2] ? (
            <Text style={[styles.small, { color: theme.onSurface }]}>
              Published:{' '}
              <Text style={{ color: theme.onSurfaceVariant }}>
                {novel.info[2]}
              </Text>
            </Text>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
};

export default DiscoverNovelCard;

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    flex: 1,
    margin: 8,
  },
  cover: {
    borderBottomLeftRadius: 8,
    borderTopLeftRadius: 8,
    width: 100,
  },
  infoContainer: {
    flex: 1,
    padding: 16,
  },
  pressable: {
    flex: 1,
    flexDirection: 'row',
  },
  small: {
    fontSize: 12,
    marginVertical: 4,
  },
  title: {
    fontSize: 16,
    marginBottom: 4,
  },
});
