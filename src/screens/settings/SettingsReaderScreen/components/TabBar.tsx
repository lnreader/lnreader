import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { ThemeColors } from '@theme/types';

export interface Tab {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  theme: ThemeColors;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTab,
  onTabChange,
  theme,
}) => {
  return (
    <View style={styles.container}>
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            style={[
              styles.tab,
              isActive && { borderBottomColor: theme.primary },
            ]}
            onPress={() => onTabChange(tab.id)}
            android_ripple={{
              color: theme.rippleColor,
              borderless: false,
            }}
          >
            <MaterialCommunityIcons
              name={tab.icon}
              size={20}
              color={isActive ? theme.primary : theme.onSurfaceVariant}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

export default TabBar;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.12)',
    backgroundColor: 'transparent', // Will be set by theme if needed, but the lint was about static style
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    minHeight: 48,
    borderBottomWidth: 2,
  },
});
