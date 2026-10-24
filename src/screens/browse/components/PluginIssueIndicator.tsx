import { StyleSheet, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';

import { usePluginIssueCategory } from '@hooks/persisted/usePluginIssues';
import { getString } from '@i18n/translations';
import type { ThemeColors } from '@theme/types';
import { pluginIssuePresentation } from '../utils/pluginIssuePresentation';

interface PluginIssueIndicatorProps {
  pluginId: string;
  pluginName: string;
  theme: ThemeColors;
}

export function PluginIssueIndicator({
  pluginId,
  pluginName,
  theme,
}: PluginIssueIndicatorProps) {
  const category = usePluginIssueCategory(pluginId);

  if (category === undefined) {
    return null;
  }

  const { colorKey, iconName, labelKey } = pluginIssuePresentation[category];

  return (
    <View
      accessible
      accessibilityLabel={getString('browseScreen.issueIndex.indicator', {
        name: pluginName,
        category: getString(`browseScreen.issueIndex.categories.${labelKey}`),
      })}
      accessibilityRole="image"
      style={styles.indicator}
    >
      <MaterialCommunityIcons
        color={theme[colorKey] as string}
        name={iconName}
        size={24}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    alignItems: 'center',
    flexShrink: 0,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
});
