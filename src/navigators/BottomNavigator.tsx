import React, { useCallback, useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Library from '../screens/library/LibraryScreen';
import Updates from '../screens/updates/UpdatesScreen';
import History from '../screens/history/HistoryScreen';
import Browse from '../screens/browse/BrowseScreen';
import More from '../screens/more/MoreScreen';

import { getString } from '@strings/translations';
import { useAppSettings, usePlugins, useTheme } from '@hooks/persisted';
import { BottomNavigatorParamList } from './types';
import Icon from '@react-native-vector-icons/material-design-icons';
import { MaterialDesignIconName } from '@type/icon';
import { BottomTabBar } from '@components';

const Tab = createBottomTabNavigator<BottomNavigatorParamList>();

const BottomNavigator = () => {
  const theme = useTheme();

  const {
    showHistoryTab = true,
    showUpdatesTab = true,
    showLabelsInNav = false,
  } = useAppSettings();

  const { filteredInstalledPlugins } = usePlugins();
  const pluginsWithUpdate = useMemo(
    () => filteredInstalledPlugins.filter(p => p.hasUpdate).length,
    [filteredInstalledPlugins],
  );

  const renderIcon = useCallback(
    ({ color, route }: { route: { name: string }; color: string }) => {
      let iconName: MaterialDesignIconName;
      switch (route.name) {
        case 'Library':
          iconName = 'bookmark-box-multiple';
          break;
        case 'Updates':
          iconName = 'alert-decagram-outline';
          break;
        case 'History':
          iconName = 'history';
          break;
        case 'Browse':
          iconName = 'compass-outline';
          break;
        case 'More':
          iconName = 'dots-horizontal';
          break;
        default:
          iconName = 'circle';
      }

      return <Icon name={iconName} color={color} size={24} />;
    },
    [],
  );

  return (
    <Tab.Navigator
      screenOptions={() => ({
        headerShown: false,
        animation: 'shift',
        lazy: true,
        tabBarBadgeStyle: {
          backgroundColor: theme.error,
          color: theme.onError,
        },
      })}
      tabBar={props => (
        <BottomTabBar
          {...props}
          theme={theme}
          showLabelsInNav={showLabelsInNav}
          renderIcon={renderIcon}
        />
      )}
    >
      <Tab.Screen
        name="Library"
        component={Library}
        options={{
          title: getString('library'),
        }}
      />
      {showUpdatesTab ? (
        <Tab.Screen
          name="Updates"
          component={Updates}
          options={{
            title: getString('updates'),
          }}
        />
      ) : null}
      {showHistoryTab ? (
        <Tab.Screen
          name="History"
          component={History}
          options={{
            title: getString('history'),
          }}
        />
      ) : null}
      <Tab.Screen
        name="Browse"
        component={Browse}
        options={{
          title: getString('browse'),
          tabBarBadge: pluginsWithUpdate
            ? pluginsWithUpdate.toString()
            : undefined,
        }}
      />
      <Tab.Screen
        name="More"
        component={More}
        options={{
          title: getString('more'),
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomNavigator;
