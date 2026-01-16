import React from 'react';
import { StyleSheet, View, Text, Pressable, Image } from 'react-native';

import { coverPlaceholderColor } from '../theme/colors';

import color from 'color';
import { ThemeColors } from '@theme/types';
import { NovelItem } from '@plugins/types';
import { NovelInfo } from '@database/types';

interface ListViewProps {
  item: NovelItem | NovelInfo;
  downloadBadge?: React.ReactNode;
  unreadBadge?: React.ReactNode;
  inLibraryBadge?: React.ReactNode;
  theme: ThemeColors;
  onPress: () => void;
  isSelected?: boolean;
  onLongPress?: () => void;
}

const ListView = ({
  item,
  downloadBadge,
  unreadBadge,
  inLibraryBadge,
  theme,
  onPress,
  isSelected,
  onLongPress,
}: ListViewProps) => {
  const fadedImage = { opacity: inLibraryBadge ? 0.5 : 1 };
  return (
    <Pressable
      android_ripple={{ color: theme.rippleColor }}
      style={[
        styles.listView,
        isSelected && {
          backgroundColor: color(theme.primary).alpha(0.12).string(),
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Image
        source={{
          uri: item.cover,
        }}
        style={[styles.extensionIcon, fadedImage]}
      />
      <Text
        style={[{ color: theme.onSurface }, styles.novelName]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
      <View style={styles.badgeContainer}>
        {downloadBadge}
        {unreadBadge}
        {inLibraryBadge}
      </View>
    </Pressable>
  );
};

export default ListView;

const styles = StyleSheet.create({
  badgeContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  extensionIcon: {
    backgroundColor: coverPlaceholderColor,
    borderRadius: 4,
    height: 40,
    width: 40,
  },
  listView: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  novelName: {
    flex: 1,
    flexWrap: 'wrap',
    fontSize: 15,
    marginStart: 16,
    paddingEnd: 8,
  },
});
