import { getString } from '@i18n/translations';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { ThemeColors } from '@theme/types';

interface NovelSummaryProps {
  summary: string;
  isExpanded: boolean;
  theme: ThemeColors;
}

const NovelSummary: React.FC<NovelSummaryProps> = ({
  summary,
  isExpanded,
  theme,
}) => {
  const textColor = theme.onSurfaceVariant;

  const [expanded, setExpanded] = useState(isExpanded);
  const toggleExpanded = () => {
    if (summary) {
      setExpanded(!expanded);
    }
  };

  const bottom = expanded ? 0 : 4;
  const containerBottomPadding = expanded ? 24 : 8;
  const opacity = expanded ? 1 : 0.7;

  return (
    <Pressable
      style={[
        styles.summaryContainer,
        { paddingBottom: containerBottomPadding },
      ]}
      onPress={toggleExpanded}
    >
      <Text
        style={[styles.summaryText, { color: textColor }]}
        numberOfLines={expanded ? Number.MAX_SAFE_INTEGER : 3}
      >
        {summary || getString('novelScreen.noSummary')}
      </Text>
      {summary ? (
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: theme.background,
              bottom,
              opacity,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            color={theme.onBackground}
            size={24}
            style={[{ backgroundColor: theme.background }, styles.icon]}
          />
        </View>
      ) : null}
    </Pressable>
  );
};

export default NovelSummary;

const styles = StyleSheet.create({
  icon: {
    borderRadius: 50,
  },
  iconContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  summaryContainer: {
    marginBottom: 8,
    padding: 16,
    paddingTop: 8,
  },
  summaryText: {
    lineHeight: 20,
  },
});
