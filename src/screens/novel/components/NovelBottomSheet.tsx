import React, { useCallback, useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  useWindowDimensions,
  Pressable,
  ScrollView,
  Modal as RNModal,
} from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import color from 'color';

import { TabView, SceneMap, TabBar, TabViewProps } from 'react-native-tab-view';
import { BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { getString } from '@i18n/translations';

import { Checkbox, SortItem } from '@components/Checkbox/Checkbox';
import { Button } from '@components';

import { overlay } from 'react-native-paper';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { ThemeColors } from '@theme/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNovelSettings } from '@hooks/persisted/useNovelSettings';
import { useNovelValue } from '@screens/novel/NovelContext';

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
    setChapterFilterValue,
    setShowChapterTitles,
    sort,
    showChapterTitles,
    excludedScanlators = [],
    setExcludedScanlators,
  } = useNovelSettings();

  const rawScanlators = useNovelValue('scanlators') || [];
  const scanlators = useMemo(
    () => [...rawScanlators].sort((a, b) => a.localeCompare(b)),
    [rawScanlators],
  );
  const [scanlatorsModalVisible, setScanlatorsModalVisible] = useState(false);
  const [tempExcludedScanlators, setTempExcludedScanlators] = useState<
    string[]
  >([]);

  const toggleTempScanlator = useCallback(
    (scanlator: string) => {
      const nextExcluded = tempExcludedScanlators.includes(scanlator)
        ? tempExcludedScanlators.filter(s => s !== scanlator)
        : [...tempExcludedScanlators, scanlator];
      setTempExcludedScanlators(nextExcluded);
    },
    [tempExcludedScanlators],
  );

  const { left, right } = useSafeAreaInsets();
  const readStatus = getChapterFilterState('read');
  const unreadStatus =
    readStatus === 'indeterminate'
      ? true
      : readStatus
      ? 'indeterminate'
      : false;

  const FirstRoute = useCallback(
    () => (
      <BottomSheetScrollView style={styles.flex}>
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
          status={unreadStatus}
          onPress={() => {
            switch (readStatus) {
              case 'indeterminate':
                setChapterFilterValue('read', 'ON');
                break;
              case true:
                setChapterFilterValue('read', 'OFF');
                break;
              default:
                setChapterFilterValue('read', 'INDETERMINATE');
            }
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
        {scanlators.length > 0 && (
          <View style={styles.scanlatorsContainer}>
            <Pressable
              style={styles.scanlatorHeader}
              onPress={() => {
                setTempExcludedScanlators(excludedScanlators);
                setScanlatorsModalVisible(true);
              }}
            >
              <Text
                style={[
                  styles.sectionHeader,
                  { color: theme.onSurfaceVariant, flex: 1 },
                ]}
              >
                {getString('novelScreen.bottomSheet.filters.scanlators')}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                color={theme.onSurfaceVariant}
                size={20}
                style={styles.chevron}
              />
            </Pressable>
          </View>
        )}
      </BottomSheetScrollView>
    ),
    [
      cycleChapterFilter,
      getChapterFilterState,
      readStatus,
      setChapterFilterValue,
      theme,
      unreadStatus,
      scanlators,
      excludedScanlators,
    ],
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
    <>
      <BottomSheet
        snapPoints={[290]}
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
      {scanlators.length > 0 && (
        <RNModal
          visible={scanlatorsModalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setScanlatorsModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.scanlatorModalContent,
                { backgroundColor: theme.surface },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
                {getString('novelScreen.bottomSheet.filters.scanlators')}
              </Text>
              <ScrollView style={styles.scanlatorModalScroll}>
                {scanlators.map(scanlator => (
                  <Checkbox
                    key={scanlator}
                    theme={theme}
                    label={scanlator}
                    status={tempExcludedScanlators.includes(scanlator)}
                    onPress={() => toggleTempScanlator(scanlator)}
                  />
                ))}
              </ScrollView>
              <View style={styles.modalFooterCtn}>
                <Button
                  title={getString('common.submit')}
                  onPress={() => {
                    setExcludedScanlators(tempExcludedScanlators);
                    setScanlatorsModalVisible(false);
                  }}
                />
                <Button
                  title={getString('common.cancel')}
                  onPress={() => setScanlatorsModalVisible(false)}
                />
                <Button
                  title={getString('common.reset')}
                  onPress={() => setTempExcludedScanlators([])}
                />
              </View>
            </View>
          </View>
        </RNModal>
      )}
    </>
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
    height: 290,
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
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  scanlatorsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    marginTop: 8,
    paddingBottom: 16,
  },
  scanlatorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
  },
  chevron: {
    marginTop: 8,
  },
  scanlatorModalContent: {
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
    width: '90%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanlatorModalScroll: {
    marginTop: 10,
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalFooterCtn: {
    flexDirection: 'row-reverse',
    paddingTop: 8,
  },
});
