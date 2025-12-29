import React, { useCallback, useState } from 'react';
import { StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import color from 'color';

import { TabView, SceneMap, TabBar, TabViewProps } from 'react-native-tab-view';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { getString } from '@strings/translations';

import { Checkbox, SortItem } from '@components/Checkbox/Checkbox';

import { overlay } from 'react-native-paper';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { ThemeColors } from '@theme/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNovelSettings } from '@hooks/persisted/useNovelSettings';

interface ChaptersSettingsSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModalMethods | null>;
  theme: ThemeColors;
}

const ChaptersSettingsSheet = ({
  bottomSheetRef,
  theme,
}: ChaptersSettingsSheetProps) => {
  const {
    setChapterSort,
    getChapterFilterState,
    cycleChapterFilter,
    setShowChapterTitles,
    sort,
    showChapterTitles,
  } = useNovelSettings();

  const { left, right } = useSafeAreaInsets();

  const FirstRoute = useCallback(
    () => (
      <View style={styles.flex}>
        <Checkbox
          theme={theme}
          label={getString('novelScreen.bottomSheet.filters.downloaded')}
          status={getChapterFilterState('downloaded')}
          onPress={() => {
            cycleChapterFilter('downloaded');
          }}
        />
        <Checkbox
          theme={theme}
          label={getString('novelScreen.bottomSheet.filters.unread')}
          status={getChapterFilterState('read')}
          onPress={() => {
            cycleChapterFilter('read');
          }}
        />
        <Checkbox
          theme={theme}
          label={getString('novelScreen.bottomSheet.filters.bookmarked')}
          status={getChapterFilterState('bookmarked')}
          onPress={() => {
            cycleChapterFilter('bookmarked');
          }}
        />
      </View>
    ),
    [cycleChapterFilter, getChapterFilterState, theme],
  );

  const SecondRoute = useCallback(
    () => (
      <View style={styles.flex}>
        <SortItem
          label={getString('novelScreen.bottomSheet.order.bySource')}
          status={
            sort === 'positionAsc'
              ? 'asc'
              : sort === 'positionDesc'
              ? 'desc'
              : undefined
          }
          onPress={() =>
            sort === 'positionAsc'
              ? setChapterSort('positionDesc')
              : setChapterSort('positionAsc')
          }
          theme={theme}
        />
        <SortItem
          label={getString('novelScreen.bottomSheet.order.byChapterName')}
          status={
            sort === 'nameAsc'
              ? 'asc'
              : sort === 'nameDesc'
              ? 'desc'
              : undefined
          }
          onPress={() =>
            sort === 'nameAsc'
              ? setChapterSort('nameDesc')
              : setChapterSort('nameAsc')
          }
          theme={theme}
        />
      </View>
    ),
    [sort, setChapterSort, theme],
  );

  const ThirdRoute = useCallback(
    () => (
      <View style={styles.flex}>
        <Checkbox
          status={showChapterTitles ?? true}
          label={getString('novelScreen.bottomSheet.displays.sourceTitle')}
          onPress={() => setShowChapterTitles(true)}
          theme={theme}
        />
        <Checkbox
          status={!showChapterTitles}
          label={getString('novelScreen.bottomSheet.displays.chapterNumber')}
          onPress={() => setShowChapterTitles(false)}
          theme={theme}
        />
      </View>
    ),
    [setShowChapterTitles, showChapterTitles, theme],
  );

  const renderScene = SceneMap({
    first: FirstRoute,
    second: SecondRoute,
    third: ThirdRoute,
  });

  const layout = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'first', title: getString('common.filter') },
    { key: 'second', title: getString('common.sort') },
    { key: 'third', title: getString('common.display') },
  ]);

  const renderTabBar: TabViewProps<any>['renderTabBar'] = props => (
    <TabBar
      {...props}
      indicatorStyle={{ backgroundColor: theme.primary }}
      style={[
        {
          backgroundColor: overlay(2, theme.surface),
          borderBottomColor: theme.outline,
        },
        styles.tabBar,
      ]}
      inactiveColor={theme.onSurfaceVariant}
      activeColor={theme.primary}
      pressColor={color(theme.primary).alpha(0.12).string()}
    />
  );

  const renderLabel = useCallback(
    ({ route, color: localColor }: { route: any; color: string }) => {
      return <Text style={{ color: localColor }}>{route.title}</Text>;
    },
    [],
  );
  return (
    <BottomSheet
      snapPoints={[240]}
      bottomSheetRef={bottomSheetRef}
      backgroundStyle={styles.transparent}
    >
      <BottomSheetView
        style={[
          styles.contentContainer,
          {
            backgroundColor: overlay(2, theme.surface),
            marginLeft: left,
            marginRight: right,
          },
        ]}
      >
        <TabView
          commonOptions={{
            label: renderLabel,
          }}
          navigationState={{ index, routes }}
          renderTabBar={renderTabBar}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
          style={styles.tabView}
        />
      </BottomSheetView>
    </BottomSheet>
  );
};

export default ChaptersSettingsSheet;

const styles = StyleSheet.create({
  contentContainer: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    flex: 1,
  },
  tabView: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: 240,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  flex: {
    flex: 1,
  },
  tabBar: {
    borderBottomWidth: 1,
    elevation: 0,
  },
});
