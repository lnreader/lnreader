import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { SceneMap, TabDescriptor, TabView } from 'react-native-tab-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppSettings, useLibrarySettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { Checkbox, SortItem } from '@components/Checkbox/Checkbox';
import {
  DisplayModes,
  displayModesList,
  LibraryFilterKey,
  libraryFilterList,
  LibraryFilterState,
  LibrarySortOrder,
  librarySortOrderList,
  nextLibraryFilterState,
} from '@screens/library/constants/constants';
import {
  buildLibraryGenres,
  LibraryGenre,
} from '@screens/library/utils/genres';
import { getNovelsWithGenresFromDb } from '@database/queries/StatsQueries';
import { showToast } from '@utils/showToast';
import { getErrorMessage } from '@utils/error';
import { RadioButton } from '@components/RadioButton/RadioButton';
import {
  BottomSheetView,
  useBottomSheetScrollableCreator,
} from '@gorhom/bottom-sheet';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { getBottomSheetLayout } from '@components/BottomSheet/layout';
import { TopTabBar } from '@components';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { LegendList } from '@legendapp/list/react-native';

interface LibraryBottomSheetProps {
  bottomSheetRef: RefObject<BottomSheetModalMethods | null>;
  style?: StyleProp<ViewStyle>;
}

const SHEET_HEIGHT = 520;

type FilterRow =
  | { type: 'filter'; key: LibraryFilterKey; label: string }
  | { type: 'genresHeader' }
  | { type: 'genre'; genre: LibraryGenre };

const checkboxStatus = (state?: LibraryFilterState) =>
  state === 'include' ? true : state === 'exclude' ? 'excluded' : false;

const genreState = (
  name: string,
  includedGenres: string[],
  excludedGenres: string[],
): LibraryFilterState | undefined =>
  includedGenres.includes(name)
    ? 'include'
    : excludedGenres.includes(name)
    ? 'exclude'
    : undefined;

const FirstRoute = () => {
  const theme = useTheme();
  const {
    filters,
    includedGenres,
    excludedGenres,
    setLibrarySettings,
    downloadedOnlyMode = false,
  } = useLibrarySettings();
  const BottomSheetLegendListScrollable = useBottomSheetScrollableCreator();

  const [libraryGenres, setLibraryGenres] = useState<LibraryGenre[]>([]);
  useEffect(() => {
    let active = true;
    getNovelsWithGenresFromDb()
      .then(novels => {
        if (active) {
          setLibraryGenres(buildLibraryGenres(novels));
        }
      })
      .catch(error => {
        if (active) {
          showToast(getErrorMessage(error));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<FilterRow[]>(() => {
    const genres = [...libraryGenres];
    // Keep a selected genre that no novel has any more, so it can be cleared.
    for (const name of [...includedGenres, ...excludedGenres]) {
      if (!genres.some(genre => genre.name === name)) {
        genres.push({ name, label: name });
      }
    }
    return [
      ...libraryFilterList.map(
        ({ key, label }): FilterRow => ({ type: 'filter', key, label }),
      ),
      ...(genres.length
        ? [
            { type: 'genresHeader' } as const,
            ...genres.map((genre): FilterRow => ({ type: 'genre', genre })),
          ]
        : []),
    ];
  }, [excludedGenres, includedGenres, libraryGenres]);

  const cycleGenre = (name: string) => {
    const next = nextLibraryFilterState(
      genreState(name, includedGenres, excludedGenres),
    );
    setLibrarySettings({
      includedGenres:
        next === 'include'
          ? [...includedGenres, name]
          : includedGenres.filter(genre => genre !== name),
      excludedGenres:
        next === 'exclude'
          ? [...excludedGenres, name]
          : excludedGenres.filter(genre => genre !== name),
    });
  };

  const renderItem = ({ item }: { item: FilterRow }) => {
    switch (item.type) {
      case 'filter': {
        const lockedByDownloadedOnly =
          item.key === 'downloaded' && downloadedOnlyMode;
        return (
          <Checkbox
            label={item.label}
            theme={theme}
            status={
              lockedByDownloadedOnly ? true : checkboxStatus(filters[item.key])
            }
            onPress={() =>
              setLibrarySettings({
                filters: {
                  ...filters,
                  [item.key]: nextLibraryFilterState(filters[item.key]),
                },
              })
            }
            disabled={lockedByDownloadedOnly}
          />
        );
      }
      case 'genresHeader':
        return (
          <Text
            style={[styles.sectionHeader, { color: theme.onSurfaceVariant }]}
          >
            {getString('libraryScreen.bottomSheet.filters.genres')}
          </Text>
        );
      case 'genre':
        return (
          <Checkbox
            label={item.genre.label}
            theme={theme}
            status={checkboxStatus(
              genreState(item.genre.name, includedGenres, excludedGenres),
            )}
            onPress={() => cycleGenre(item.genre.name)}
          />
        );
    }
  };

  return (
    <View style={styles.flex}>
      <LegendList
        recycleItems
        estimatedItemSize={48}
        extraData={[
          filters,
          includedGenres,
          excludedGenres,
          downloadedOnlyMode,
        ]}
        data={rows}
        getItemType={item => item.type}
        keyExtractor={item =>
          item.type === 'filter'
            ? `filter_${item.key}`
            : item.type === 'genre'
            ? `genre_${item.genre.name}`
            : item.type
        }
        renderItem={renderItem}
        renderScrollComponent={BottomSheetLegendListScrollable}
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

const bottomSheetSceneMap = SceneMap({
  first: FirstRoute,
  second: SecondRoute,
  third: ThirdRoute,
});

const LibraryBottomSheet: React.FC<LibraryBottomSheetProps> = ({
  bottomSheetRef,
  style,
}) => {
  const theme = useTheme();
  const { reduceAppAnimations = false } = useAppSettings();

  const layout = useWindowDimensions();
  const { bottom, top } = useSafeAreaInsets();
  const { maxHeight } = getBottomSheetLayout({
    bottom,
    height: layout.height,
    top,
    width: layout.width,
  });

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
    <BottomSheet bottomSheetRef={bottomSheetRef} snapPoints={[SHEET_HEIGHT]}>
      <BottomSheetView style={styles.bottomSheetCtn}>
        <TabView
          animationEnabled={!reduceAppAnimations}
          commonOptions={commonOptions}
          navigationState={{ index, routes }}
          renderTabBar={renderTabBar}
          renderScene={bottomSheetSceneMap}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
          style={{ height: Math.min(SHEET_HEIGHT, maxHeight) }}
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
  flex: { flex: 1 },
});
