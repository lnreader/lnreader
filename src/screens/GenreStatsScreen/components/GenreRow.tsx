import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import type { ThemeColors } from '@theme/types';

interface GenreRowProps {
  name: string;
  count: number;
  maxCount: number; // global max across all genres
  theme: ThemeColors;
  isChild?: boolean; // indented, smaller font if true
  showBar?: boolean; // default true; set false for parent header rows
  onPress?: () => void;
}

const GenreRow: React.FC<GenreRowProps> = ({
  name,
  count,
  maxCount,
  theme,
  isChild = false,
  showBar = true,
  onPress,
}) => {
  const barWidth =
    count > 0 ? (maxCount > 0 ? (count / maxCount) * 100 : 0) : 0;

  const barStyle: ViewStyle = {
    width: `${Math.max(barWidth, count > 0 ? 2 : 0)}%`,
    backgroundColor: theme.primary,
    height: '100%',
    borderRadius: 6,
  };

  const row = (
    <View style={[styles.row, isChild && styles.childRow]}>
      <Text
        style={[
          styles.label,
          {
            color: theme.onSurface,
            fontWeight: isChild ? '400' : '600',
          },
        ]}
        numberOfLines={2}
      >
        {name}
      </Text>
      {showBar && (
        <View
          style={[styles.barTrack, { backgroundColor: theme.surfaceVariant }]}
        >
          <View style={barStyle} />
        </View>
      )}
      <Text style={[styles.count, { color: theme.onSurfaceVariant }]}>
        {count}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${count}`}
      >
        {row}
      </Pressable>
    );
  }

  return row;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  childRow: {
    paddingLeft: 16,
  },
  label: {
    flex: 1,
    fontSize: 14,
  },
  barTrack: {
    flex: 2,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  count: {
    width: 40,
    textAlign: 'right',
    fontSize: 14,
  },
});

export default GenreRow;
