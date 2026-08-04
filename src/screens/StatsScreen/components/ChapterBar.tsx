import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

interface ChapterBarProps {
  read: number;
  total: number;
  downloaded: number;
}

export const ChapterBar: React.FC<ChapterBarProps> = ({
  read,
  total,
  downloaded,
}) => {
  const theme = useTheme();

  const readPercent = total > 0 ? Math.min(read / total, 1) : 0;

  return (
    <View style={styles.container}>
      <Text style={[styles.totalLabel, { color: theme.onSurface }]}>
        {getString('statsScreen.totalChapters')}
      </Text>
      <Text style={[styles.totalCount, { color: theme.onSurface }]}>
        {total}
      </Text>
      <View style={[styles.track, { backgroundColor: theme.surfaceVariant }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${readPercent * 100}%` as any,
              backgroundColor: theme.primary,
            },
          ]}
        />
      </View>
      {total > 0 && (
        <View style={styles.labelsRow}>
          <View style={styles.labelCol}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: 12 }}>
              {getString('statsScreen.readChapters')}
            </Text>
            <Text
              style={{
                color: theme.onSurface,
                fontWeight: 'bold',
                fontSize: 14,
              }}
            >
              {read}
            </Text>
          </View>
          <View style={styles.labelCol}>
            <Text style={{ color: theme.onSurfaceVariant, fontSize: 12 }}>
              {getString('statsScreen.downloadedChapters')}
            </Text>
            <Text
              style={{
                color: theme.onSurface,
                fontWeight: 'bold',
                fontSize: 14,
              }}
            >
              {downloaded}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  totalCount: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 4,
  },
  track: {
    height: 20,
    borderRadius: 10,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 10,
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  labelCol: {
    flex: 1,
    alignItems: 'center',
  },
});
