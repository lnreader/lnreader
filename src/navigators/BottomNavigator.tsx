import { useCallback, useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import Library from '../screens/library/LibraryScreen';

import { getString } from '@i18n/translations';
import {
  useAppSettings,
  useFilteredInstalledPlugins,
  useTheme,
} from '@hooks/persisted';
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

  const filteredInstalledPlugins = useFilteredInstalledPlugins();
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

  const renderTabBar = useCallback(
    (props: any) => (
      <BottomTabBar
        {...props}
        theme={theme}
        showLabelsInNav={showLabelsInNav}
        renderIcon={renderIcon}
      />
    ),
    [theme, showLabelsInNav, renderIcon],
  );

  return (
    <Tab.Navigator
      screenOptions={() => ({
        headerShown: false,
        animation: 'fade',
        lazy: true,
        tabBarBadgeStyle: {
          backgroundColor: theme.error,
          color: theme.onError,
        },
      })}
      tabBar={renderTabBar}
    >
      <Tab.Screen
        name="Library"
        component={Library}
        options={{
          title: getString('library'),
        }}
      />
      {/*
       * The tabs already mount lazily, but importing their screens here still
       * evaluated all of them during startup. `getComponent` ties the module
       * to the tab actually being opened; Library stays eager because it is
       * the tab the app opens on.
       */}
      {showUpdatesTab ? (
        <Tab.Screen
          name="Updates"
          getComponent={() =>
            require('../screens/updates/UpdatesScreen').default
          }
          options={{
            title: getString('updates'),
          }}
        />
      ) : null}
      {showHistoryTab ? (
        <Tab.Screen
          name="History"
          getComponent={() =>
            require('../screens/history/HistoryScreen').default
          }
          options={{
            title: getString('history'),
          }}
        />
      ) : null}
      <Tab.Screen
        name="Browse"
        getComponent={() => require('../screens/browse/BrowseScreen').default}
        options={{
          title: getString('browse'),
          freezeOnBlur: false,
          tabBarBadge: pluginsWithUpdate
            ? pluginsWithUpdate.toString()
            : undefined,
        }}
      />
      <Tab.Screen
        name="More"
        getComponent={() => require('../screens/more/MoreScreen').default}
        options={{
          title: getString('more'),
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomNavigator;
