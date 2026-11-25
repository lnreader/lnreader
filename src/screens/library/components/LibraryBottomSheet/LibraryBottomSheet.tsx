import React, { RefObject, useCallback, useMemo, useState } from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { TabDescriptor, TabView } from 'react-native-tab-view';

import { useAppSettings, useLibrarySettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import {
  Checkbox,
  SortItem,
  TriStateCheckbox,
} from '@components/Checkbox/Checkbox';
import {
  DisplayModes,
  displayModesList,
  LibraryFilterKey,
  libraryFilterList,
  LibraryFilterState,
  LibraryGenreFilter,
  LibrarySortOrder,
  librarySortOrderList,
  nextLibraryFilterState,
  resolveLibraryFilters,
} from '@screens/library/constants/constants';
import type { LibraryGenreOption } from '@screens/library/utils/genreFilter';
import { RadioButton } from '@components/RadioButton/RadioButton';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { TopTabBar } from '@components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { LegendList } from '@legendapp/list/react-native';

interface LibraryBottomSheetProps {
  bottomSheetRef: RefObject<BottomSheetModalMethods | null>;
  genreOptions: LibraryGenreOption[];
  style?: StyleProp<ViewStyle>;
}

type FilterListItem =
  | { type: 'header'; key: string; label: string }
  | { type: 'status'; key: LibraryFilterKey; label: string }
  | { type: 'genre'; key: string; label: string };

const genreStateOf = (
  genreFilter: LibraryGenreFilter,
  key: string,
): LibraryFilterState | undefined =>
  genreFilter.include.includes(key)
    ? 'include'
    : genreFilter.exclude.includes(key)
    ? 'exclude'
    : undefined;

const withGenreState = (
  genreFilter: LibraryGenreFilter,
  key: string,
  state: LibraryFilterState | undefined,
): LibraryGenreFilter => ({
  include: [
    ...genreFilter.include.filter(k => k !== key),
    ...(state === 'include' ? [key] : []),
  ],
  exclude: [
    ...genreFilter.exclude.filter(k => k !== key),
    ...(state === 'exclude' ? [key] : []),
  ],
});

const emptyGenreFilter: LibraryGenreFilter = { include: [], exclude: [] };

const FilterRoute = ({
  genreOptions,
}: {
  genreOptions: LibraryGenreOption[];
}) => {
  const theme = useTheme();
  const {
    filter: legacyFilter,
    libraryFilters,
    genreFilter = emptyGenreFilter,
    setLibrarySettings,
    downloadedOnlyMode = false,
  } = useLibrarySettings();
  const filters = resolveLibraryFilters(libraryFilters, legacyFilter);

  const data = useMemo<FilterListItem[]>(
    () => [
      ...(genreOptions.length
        ? [
            {
              type: 'header' as const,
              key: 'status',
              label: getString('libraryScreen.bottomSheet.filters.status'),
            },
          ]
        : []),
      ...libraryFilterList.map(item => ({
        type: 'status' as const,
        key: item.key,
        label: item.label,
      })),
      ...(genreOptions.length
        ? [
            {
              type: 'header' as const,
              key: 'genres',
              label: getString('libraryScreen.bottomSheet.filters.genres'),
            },
            ...genreOptions.map(option => ({
              type: 'genre' as const,
              key: option.key,
              label: option.label,
            })),
          ]
        : []),
    ],
    [genreOptions],
  );

  const renderItem = ({ item }: { item: FilterListItem }) => {
    if (item.type === 'header') {
      return (
        <Text style={[styles.sectionHeader, { color: theme.onSurfaceVariant }]}>
          {item.label}
        </Text>
      );
    }
    if (item.type === 'status') {
      const isForcedByDownloadedOnly =
        item.key === 'downloaded' && downloadedOnlyMode;
      return (
        <TriStateCheckbox
          label={item.label}
          theme={theme}
          status={isForcedByDownloadedOnly ? 'include' : filters[item.key]}
          disabled={isForcedByDownloadedOnly}
          onPress={() => {
            const nextState = nextLibraryFilterState(filters[item.key]);
            const { [item.key]: _removed, ...rest } = filters;
            setLibrarySettings({
              filter: undefined,
              libraryFilters: nextState
                ? { ...rest, [item.key]: nextState }
                : rest,
            });
          }}
        />
      );
    }
    const state = genreStateOf(genreFilter, item.key);
    return (
      <TriStateCheckbox
        label={item.label}
        theme={theme}
        status={state}
        onPress={() =>
          setLibrarySettings({
            genreFilter: withGenreState(
              genreFilter,
              item.key,
              nextLibraryFilterState(state),
            ),
          })
        }
      />
    );
  };

  return (
    <View style={styles.flex}>
      <LegendList
        recycleItems
        estimatedItemSize={48}
        extraData={[filters, genreFilter, downloadedOnlyMode]}
        data={data}
        keyExtractor={item => `${item.type}_${item.key}`}
        getItemType={item => item.type}
        renderItem={renderItem}
      />
    </View>
  );
};

const SecondRoute = () => {
  const theme = useTheme();
  const { sortOrder = LibrarySortOrder.DateAdded_DESC, setLibrarySettings } =
    useLibrarySettings();

  return (
    <View style={styles.flex}>
      <LegendList
        recycleItems
        data={librarySortOrderList}
        extraData={[sortOrder]}
        estimatedItemSize={52}
        keyExtractor={(item, index) => `sort_${index}_${item.ASC}`}
        renderItem={({ item }) => (
          <SortItem
            label={item.label}
            theme={theme}
            status={
              sortOrder === item.ASC
                ? 'asc'
                : sortOrder === item.DESC
                ? 'desc'
                : undefined
            }
            onPress={() =>
              setLibrarySettings({
                sortOrder: sortOrder === item.ASC ? item.DESC : item.ASC,
              })
            }
          />
        )}
      />
    </View>
  );
};

const ThirdRoute = () => {
  const theme = useTheme();
  const {
    showDownloadBadges = true,
    showNumberOfNovels = false,
    showUnreadBadges = true,
    showContinueReadingButton = false,
    displayMode = DisplayModes.Comfortable,
    setLibrarySettings,
  } = useLibrarySettings();

  return (
    <View style={styles.flex}>
      <Text style={[styles.sectionHeader, { color: theme.onSurfaceVariant }]}>
        {getString('libraryScreen.bottomSheet.display.overlays')}
      </Text>
      <Checkbox
        label={getString('libraryScreen.bottomSheet.display.downloadBadges')}
        status={showDownloadBadges}
        onPress={() =>
          setLibrarySettings({
            showDownloadBadges: !showDownloadBadges,
          })
        }
        theme={theme}
      />
      <Checkbox
        label={getString('libraryScreen.bottomSheet.display.unreadBadges')}
        status={showUnreadBadges}
        onPress={() =>
          setLibrarySettings({
            showUnreadBadges: !showUnreadBadges,
          })
        }
        theme={theme}
      />
      <Checkbox
        label={getString('libraryScreen.bottomSheet.display.showNoOfItems')}
        status={showNumberOfNovels}
        onPress={() =>
          setLibrarySettings({
            showNumberOfNovels: !showNumberOfNovels,
          })
        }
        theme={theme}
      />
      <Checkbox
        label={getString(
          'libraryScreen.bottomSheet.display.continueReadingButton',
        )}
        status={showContinueReadingButton}
        onPress={() =>
          setLibrarySettings({
            showContinueReadingButton: !showContinueReadingButton,
          })
        }
        theme={theme}
      />
      <Text style={[styles.sectionHeader, { color: theme.onSurfaceVariant }]}>
        {getString('libraryScreen.bottomSheet.display.displayMode')}
      </Text>
      <LegendList
        recycleItems
        estimatedItemSize={48}
        data={displayModesList}
        extraData={[displayMode]}
        keyExtractor={item => `display_mode_${item.value}`}
        renderItem={({ item }) => (
          <RadioButton
            label={item.label}
            status={displayMode === item.value}
            onPress={() => setLibrarySettings({ displayMode: item.value })}
            theme={theme}
          />
        )}
      />
    </View>
  );
};

const LibraryBottomSheet: React.FC<LibraryBottomSheetProps> = ({
  bottomSheetRef,
  genreOptions,
  style,
}) => {
  const theme = useTheme();
  const { reduceAppAnimations = false } = useAppSettings();

  const layout = useWindowDimensions();

  const renderTabBar = useCallback(
    (props: any) => (
      <TopTabBar
        {...props}
        indicatorStyle={{ backgroundColor: theme.primary }}
        style={[
          {
            backgroundColor: theme.surfaceContainerLow ?? theme.surface,
            borderBottomColor: theme.outlineVariant,
          },
          styles.tabBar,
          style,
        ]}
        inactiveColor={theme.onSurfaceVariant}
        activeColor={theme.primary}
        pressColor={theme.rippleColor}
      />
    ),
    [
      theme.primary,
      theme.surface,
      theme.surfaceContainerLow,
      theme.onSurfaceVariant,
      theme.rippleColor,
      theme.outlineVariant,
      style,
    ],
  );

  const renderScene = useCallback(
    ({ route }: { route: { key: string } }) => {
      switch (route.key) {
        case 'first':
          return <FilterRoute genreOptions={genreOptions} />;
        case 'second':
          return <SecondRoute />;
        case 'third':
          return <ThirdRoute />;
        default:
          return null;
      }
    },
    [genreOptions],
  );

  const [index, setIndex] = useState(0);
  const routes = useMemo(
    () => [
      { key: 'first', title: getString('common.filter') },
      { key: 'second', title: getString('common.sort') },
      { key: 'third', title: getString('common.display') },
    ],
    [],
  );

  const renderCommonOptions = useCallback(
    ({ route, color: col }: { route: any; color: string }) => (
      <Text style={{ color: col }}>{route.title}</Text>
    ),
    [],
  );

  const commonOptions: TabDescriptor<{
    key: string;
    title: string;
  }> = useMemo(() => {
    return {
      label: renderCommonOptions,
    };
  }, [renderCommonOptions]);

  return (
    <BottomSheet bottomSheetRef={bottomSheetRef} snapPoints={[520]}>
      <BottomSheetView style={styles.bottomSheetCtn}>
        <TabView
          animationEnabled={!reduceAppAnimations}
          commonOptions={commonOptions}
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

export default LibraryBottomSheet;

const styles = StyleSheet.create({
  bottomSheetCtn: {
    flex: 1,
  },
  sectionHeader: {
    padding: 16,
    paddingBottom: 8,
  },
  tabBar: {
    borderBottomWidth: 1,
    elevation: 0,
  },
  tabView: {
    height: 520,
  },
  flex: { flex: 1 },
});
