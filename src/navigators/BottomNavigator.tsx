import { useCallback, useMemo, type ReactNode } from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';

import Library from '../screens/library/LibraryScreen';
import Updates from '../screens/updates/UpdatesScreen';
import History from '../screens/history/HistoryScreen';
import Browse from '../screens/browse/BrowseScreen';
import More from '../screens/more/MoreScreen';

import { getString } from '@i18n/translations';
import { useAppSettings, useFilteredInstalledPlugins } from '@hooks/persisted';
import { BottomNavigatorParamList } from './types';
import { TAB_ICONS, isTabName } from './destinations';
import { useTabPressBridge } from './NavigationRailFrame';
import {
  AppNavigationBar,
  InsetOverrideProvider,
  type NavDestination,
} from '@components';
import { useWindowLayout } from '@hooks/common/useWindowLayout';

const Tab = createBottomTabNavigator<BottomNavigatorParamList>();

const BottomNavigator = () => {
  const layout = useWindowLayout();
  const tabPressBridgeRef = useTabPressBridge();
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

  const renderTabBar = useCallback(
    ({ state, descriptors, navigation }: BottomTabBarProps) => {
      // Screens listen for re-presses (e.g. Library opens its options).
      const emitPress = (routeKey: string) =>
        navigation.emit({
          type: 'tabPress',
          target: routeKey,
          canPreventDefault: true,
        });
      if (layout.useNavigationRail) {
        // The app-wide rail is drawn by NavigationRailFrame beside every
        // screen; it forwards re-presses of the current tab here.
        if (tabPressBridgeRef) {
          tabPressBridgeRef.current = {
            press: tab => {
              const route = state.routes.find(r => r.name === tab);
              if (route) {
                emitPress(route.key);
              }
            },
          };
        }
        return null;
      }
      const destinations: NavDestination[] = state.routes.flatMap(route => {
        if (!isTabName(route.name)) {
          return [];
        }
        const { options } = descriptors[route.key];
        return [
          {
            key: route.key,
            label: options.title ?? route.name,
            ...TAB_ICONS[route.name],
            badge:
              options.tabBarBadge === undefined
                ? undefined
                : String(options.tabBarBadge),
          },
        ];
      });
      const selectedKey = state.routes[state.index].key;
      const onSelect = (key: string) => {
        const route = state.routes.find(r => r.key === key);
        if (!route) {
          return;
        }
        const event = emitPress(route.key);
        if (key !== selectedKey && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      };
      return (
        <AppNavigationBar
          destinations={destinations}
          selectedKey={selectedKey}
          onSelect={onSelect}
          showLabels={showLabelsInNav}
        />
      );
    },
    [layout.useNavigationRail, showLabelsInNav, tabPressBridgeRef],
  );

  // The bar owns the bottom system inset (the rail frame handles the left).
  const insetOverride = useMemo(
    () => (layout.useNavigationRail ? { left: 0 } : { bottom: 0 }),
    [layout.useNavigationRail],
  );
  const screenLayout = useCallback(
    ({ children }: { children: ReactNode }) => (
      <InsetOverrideProvider value={insetOverride}>
        {children}
      </InsetOverrideProvider>
    ),
    [insetOverride],
  );

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        lazy: true,
        tabBarPosition: layout.useNavigationRail ? 'left' : 'bottom',
      }}
      screenLayout={screenLayout}
      tabBar={renderTabBar}
    >
      <Tab.Screen
        name="Library"
        component={Library}
        options={{ title: getString('library') }}
      />
      {showUpdatesTab ? (
        <Tab.Screen
          name="Updates"
          component={Updates}
          options={{ title: getString('updates') }}
        />
      ) : null}
      {showHistoryTab ? (
        <Tab.Screen
          name="History"
          component={History}
          options={{ title: getString('history') }}
        />
      ) : null}
      <Tab.Screen
        name="Browse"
        component={Browse}
        options={{
          title: getString('browse'),
          freezeOnBlur: false,
          tabBarBadge: pluginsWithUpdate ? pluginsWithUpdate : undefined,
        }}
      />
      <Tab.Screen
        name="More"
        component={More}
        options={{ title: getString('more') }}
      />
    </Tab.Navigator>
  );
};

export default BottomNavigator;
