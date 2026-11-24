import React, {
  Ref,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
  type ScrollViewInstance,
} from 'react-native';
import { TabDescriptor } from 'react-native-tab-view';
import SheetTabView from '@components/BottomSheet/SheetTabView';

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
import BottomSheet, {
  BottomSheetRef,
  useTabScrollables,
} from '@components/BottomSheet/BottomSheet';
import { TopTabBar } from '@components';
import { LegendList, LegendListRef } from '@legendapp/list/react-native';

interface LibraryBottomSheetProps {
  bottomSheetRef: RefObject<BottomSheetRef | null>;
  style?: StyleProp<ViewStyle>;
}

const SNAP_POINTS = [520];

interface RouteProps {
  scrollRef: Ref<ScrollViewInstance>;
}

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

const FirstRoute = ({ scrollRef }: { scrollRef: Ref<LegendListRef> }) => {
  const theme = useTheme();
  const {
    filters,
    includedGenres,
    excludedGenres,
    setLibrarySettings,
    downloadedOnlyMode = false,
  } = useLibrarySettings();

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
        ref={scrollRef}
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
      />
    </View>
  );
};

const SecondRoute = ({ scrollRef }: RouteProps) => {
  const theme = useTheme();
  const { sortOrder = LibrarySortOrder.DateAdded_DESC, setLibrarySettings } =
    useLibrarySettings();

  return (
    <ScrollView ref={scrollRef} style={styles.flex}>
      {librarySortOrderList.map((item, index) => (
        <SortItem
          key={`sort_${index}_${item.ASC}`}
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
      ))}
    </ScrollView>
  );
};

const ThirdRoute = ({ scrollRef }: RouteProps) => {
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
    <ScrollView ref={scrollRef} style={styles.flex}>
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
      {displayModesList.map(item => (
        <RadioButton
          key={`display_mode_${item.value}`}
          label={item.label}
          status={displayMode === item.value}
          onPress={() => setLibrarySettings({ displayMode: item.value })}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
};

const LibraryBottomSheet: React.FC<LibraryBottomSheetProps> = ({
  bottomSheetRef,
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

  const [index, setIndex] = useState(0);

  const routes = useMemo(
    () => [
      { key: 'first', title: getString('common.filter') },
      { key: 'second', title: getString('common.sort') },
      { key: 'third', title: getString('common.display') },
    ],
    [],
  );

  const { register, scrollableRef } = useTabScrollables(routes[index].key);

  const renderScene = useCallback(
    ({ route }: { route: { key: string } }) => {
      const scrollRef = register(route.key);
      switch (route.key) {
        case 'first':
          return <FirstRoute scrollRef={scrollRef} />;
        case 'second':
          return <SecondRoute scrollRef={scrollRef} />;
        default:
          return <ThirdRoute scrollRef={scrollRef} />;
      }
    },
    [register],
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
    <BottomSheet
      bottomSheetRef={bottomSheetRef}
      snapPoints={SNAP_POINTS}
      scrollableRef={scrollableRef}
    >
      <View style={styles.bottomSheetCtn}>
        <SheetTabView
          animationEnabled={!reduceAppAnimations}
          commonOptions={commonOptions}
          navigationState={{ index, routes }}
          renderTabBar={renderTabBar}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
        />
      </View>
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
