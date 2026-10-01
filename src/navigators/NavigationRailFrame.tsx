import {
  createContext,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { StyleSheet, View } from 'react-native';
import {
  CommonActions,
  type NavigationHelpers,
  type NavigationState,
  type ParamListBase,
  type PartialState,
} from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMMKVObject } from 'react-native-mmkv';

import { getString } from '@i18n/translations';
import { useAppSettings, useFilteredInstalledPlugins } from '@hooks/persisted';
import {
  BACKGROUND_TASKS_STORE_KEY,
  type QueuedBackgroundTask,
} from '@services/backgroundTasks';
import {
  MORE_DESTINATIONS,
  TAB_ICONS,
  isMoreDestination,
  isTabName,
  useRailLayout,
  type TabName,
} from './destinations';
import {
  AppNavigationRail,
  InsetOverrideProvider,
  NAVIGATION_RAIL_WIDTH,
  type NavDestination,
} from '@components';
import {
  RailWidthProvider,
  useWindowLayout,
} from '@hooks/common/useWindowLayout';

export interface TabPressBridge {
  press: (tab: TabName) => void;
}

const TabPressBridgeContext =
  createContext<RefObject<TabPressBridge | null> | null>(null);

export const useTabPressBridge = () => useContext(TabPressBridgeContext);

type AnyState = NavigationState | PartialState<NavigationState>;
type AnyRoute = AnyState['routes'][number];

const screenParam = (route: AnyRoute) => {
  const screen = (route.params as { screen?: unknown } | undefined)?.screen;
  return typeof screen === 'string' ? screen : undefined;
};

const focusedIndex = (state: AnyState) =>
  state.index ?? state.routes.length - 1;

const nestedFocus = (route: AnyRoute, fallbackIndex: 'first' | 'last') => {
  const nested = route.state;
  if (!nested) {
    return screenParam(route);
  }
  const index =
    nested.index ?? (fallbackIndex === 'first' ? 0 : nested.routes.length - 1);
  return nested.routes[index]?.name;
};

// The destination the user came from stays highlighted on deeper screens.
const selectedDestination = (state: AnyState, extended: boolean) => {
  for (let i = focusedIndex(state); i >= 0; i--) {
    const route = state.routes[i];
    if (route.name === 'BottomNavigator') {
      return nestedFocus(route, 'first') ?? 'Library';
    }
    if (route.name === 'MoreStack') {
      if (!extended) {
        return 'More';
      }
      const root = route.state
        ? route.state.routes[0]?.name
        : screenParam(route);
      return root && isMoreDestination(root) ? root : undefined;
    }
  }
  return undefined;
};

const isReading = (state: AnyState) => {
  const route = state.routes[focusedIndex(state)];
  return (
    route?.name === 'ReaderStack' && nestedFocus(route, 'last') === 'Chapter'
  );
};

const NavigationRailFrame = ({
  state,
  navigation,
  children,
}: {
  state: NavigationState;
  navigation: NavigationHelpers<ParamListBase>;
  children: ReactNode;
}) => {
  const { rail, extended } = useRailLayout();
  const layout = useWindowLayout();
  const { left } = useSafeAreaInsets();
  const bridge = useRef<TabPressBridge>(null);
  const {
    showHistoryTab = true,
    showUpdatesTab = true,
    showLabelsInNav = true,
  } = useAppSettings();
  const installedPlugins = useFilteredInstalledPlugins();
  const [taskQueue] = useMMKVObject<QueuedBackgroundTask[]>(
    BACKGROUND_TASKS_STORE_KEY,
  );
  const pluginUpdates = installedPlugins.filter(p => p.hasUpdate).length;
  const tasks = taskQueue?.length ?? 0;

  const destinations = useMemo(() => {
    const tab = (name: TabName, label: string, badge?: number) => ({
      key: name,
      label,
      ...TAB_ICONS[name],
      badge: badge ? String(badge) : undefined,
    });
    const list: NavDestination[] = [tab('Library', getString('library'))];
    if (showUpdatesTab) {
      list.push(tab('Updates', getString('updates')));
    }
    if (showHistoryTab) {
      list.push(tab('History', getString('history')));
    }
    list.push(tab('Browse', getString('browse'), pluginUpdates));
    if (extended) {
      MORE_DESTINATIONS.forEach((destination, index) =>
        list.push({
          key: destination.name,
          label: destination.label(),
          icon: destination.icon,
          badge:
            destination.name === 'TaskQueue' && tasks
              ? String(tasks)
              : undefined,
          groupStart: index === 0,
        }),
      );
    } else {
      list.push(tab('More', getString('more')));
    }
    return list;
  }, [extended, pluginUpdates, showHistoryTab, showUpdatesTab, tasks]);

  const showRail = rail && !isReading(state);
  const selectedKey = selectedDestination(state, extended) ?? '';

  const onSelect = (key: string) => {
    const focused = state.routes[state.index];
    if (isTabName(key)) {
      if (key === selectedKey && focused?.name === 'BottomNavigator') {
        bridge.current?.press(key);
        return;
      }
      navigation.dispatch(
        CommonActions.navigate(
          'BottomNavigator',
          { screen: key },
          { pop: true },
        ),
      );
      return;
    }
    if (!isMoreDestination(key)) {
      return;
    }
    // Leave whatever was opened on top and show the destination fresh.
    navigation.dispatch(
      CommonActions.navigate('BottomNavigator', undefined, { pop: true }),
    );
    navigation.dispatch(
      CommonActions.navigate(
        'MoreStack',
        key === 'SettingsStack'
          ? // Expanded windows show a page beside the categories right away.
            {
              screen: key,
              params: {
                screen: layout.isExpanded ? 'GeneralSettings' : 'Settings',
              },
            }
          : { screen: key },
      ),
    );
  };

  // The tree keeps its shape when the rail hides (the reader) so the screens
  // are not remounted.
  return (
    <TabPressBridgeContext.Provider value={bridge}>
      <View style={styles.row}>
        {showRail ? (
          <AppNavigationRail
            destinations={destinations}
            selectedKey={selectedKey}
            onSelect={onSelect}
            showLabels={showLabelsInNav}
          />
        ) : null}
        <View style={styles.content}>
          <RailWidthProvider
            value={showRail ? NAVIGATION_RAIL_WIDTH + left : 0}
          >
            <InsetOverrideProvider
              value={showRail ? RAIL_OVERRIDE : NO_OVERRIDE}
            >
              {children}
            </InsetOverrideProvider>
          </RailWidthProvider>
        </View>
      </View>
    </TabPressBridgeContext.Provider>
  );
};

// The rail owns the left system inset.
const RAIL_OVERRIDE = { left: 0 };
const NO_OVERRIDE = {};

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  content: { flex: 1 },
});

export default NavigationRailFrame;
