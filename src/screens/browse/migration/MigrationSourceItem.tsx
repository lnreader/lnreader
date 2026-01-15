import { PluginItem } from '@plugins/types';
import { ThemeColors } from '@theme/types';
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { TouchableRipple } from 'react-native-paper';

interface MigrationSourceCardProps {
  item: PluginItem;
  theme: ThemeColors;
  noOfNovels: number;
  onPress: () => void;
}

const MigrationSourceCard = ({
  item,
  theme,
  noOfNovels,
  onPress,
}: MigrationSourceCardProps) => {
  const { name, iconUrl, lang } = item;

  return (
    <TouchableRipple
      style={styles.cardContainer}
      onPress={onPress}
      rippleColor={theme.rippleColor}
    >
      <>
        <Image source={{ uri: iconUrl }} style={styles.sourceIcon} />
        <View style={styles.sourceDetailsContainer}>
          <Text
            style={[
              {
                color: theme.onSurface,
              },
              styles.fontSize14,
            ]}
          >
            {name} {` (${noOfNovels || 0})`}
          </Text>
          <Text
            style={[
              {
                color: theme.onSurfaceVariant,
              },
              styles.fontSize12,
            ]}
          >
            {lang}
          </Text>
        </View>
      </>
    </TouchableRipple>
  );
};

export default MigrationSourceCard;

const styles = StyleSheet.create({
  cardContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  sourceDetailsContainer: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginStart: 16,
  },
  sourceIcon: {
    borderRadius: 4,
    height: 40,
    width: 40,
  },
  fontSize14: { fontSize: 14 },
  fontSize12: { fontSize: 12 },
});
