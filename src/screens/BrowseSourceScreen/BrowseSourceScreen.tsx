import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Column } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  fillMaxWidth,
  padding,
  verticalScroll,
} from '@expo/ui/jetpack-compose/modifiers';

import {
  AppHost,
  ErrorScreenV2,
  Fab,
  Screen,
  ScreenContent,
  SearchbarV2,
  SegmentedControl,
} from '@components/index';
import NovelList from '@components/NovelList';
import NovelCover from '@components/NovelCover';
import FilterBottomSheet from './components/FilterBottomSheet';

import { useSearch, useBoolean } from '@hooks';
import { useBrowseSource, useSearchSource } from './useBrowseSource';

import { NovelItem } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import { useTheme } from '@hooks/persisted';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { getString } from '@i18n/translations';
import { NovelInfo } from '@database/types';
import { BrowseSourceScreenProps } from '@navigators/types';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { useWindowLayout } from '@hooks/common/useWindowLayout';
import FilterListIcon from '@expo/material-symbols/filter_list.xml';
import PublicIcon from '@expo/material-symbols/public.xml';
import RefreshIcon from '@expo/material-symbols/refresh.xml';
import SearchIcon from '@expo/material-symbols/search.xml';

const FILTER_PANE_WIDTH = 360;

type BrowseSourceProps = BrowseSourceScreenProps & {
  onShowLatestNovelsChange: (showLatestNovels: boolean) => void;
};

const BrowseSourceScreen = ({
  route,
  navigation,
  onShowLatestNovelsChange,
}: BrowseSourceProps) => {
  const theme = useTheme();
  const layout = useWindowLayout();
  const { pluginId, pluginName, site, showLatestNovels } = route.params;
  const imageRequestInit = getPlugin(pluginId)?.imageRequestInit;

  const {
    isLoading,
    novels,
    hasNextPage,
    fetchNextPage,
    error,
    filterValues,
    setFilters,
    clearFilters,
    refetchNovels,
  } = useBrowseSource(pluginId, showLatestNovels);

  const {
    isSearching,
    searchResults,
    searchSource,
    searchNextPage,
    hasNextSearchPage,
    clearSearchResults,
    searchError,
  } = useSearchSource(pluginId);
  const novelList = searchResults.length > 0 ? searchResults : novels;
  const errorMessage = error || searchError;

  const { searchText, setSearchText, clearSearchbar } = useSearch();
  const onChangeText = (text: string) => setSearchText(text);
  const onSubmitEditing = () => {
    searchSource(searchText);
  };
  const handleClearSearchbar = () => {
    clearSearchbar();
    clearSearchResults();
  };

  const handleOpenWebView = async () => {
    navigation.navigate('WebviewScreen', {
      name: pluginName,
      url: site,
      pluginId,
    });
  };

  const { novelInLibrary, switchNovelToLibrary } = useLibraryContext();
  const [inActivity, setInActivity] = useState<Record<string, boolean>>({});

  const navigateToNovel = useCallback(
    (item: NovelItem | NovelInfo) =>
      navigation.navigate('ReaderStack', {
        screen: 'Novel',
        params: {
          ...item,
          pluginId: pluginId,
        },
      }),
    [navigation, pluginId],
  );

  const {
    value: filterSheetVisible,
    setTrue: openFilterSheet,
    setFalse: closeFilterSheet,
    toggle: toggleFilterSheet,
  } = useBoolean();
  const lastFetchDistanceRef = useRef(Infinity);
  const lastContentHeightRef = useRef(0);
  const lastOffsetYRef = useRef(-1);
  const handleScroll = (event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceFromEnd =
      contentSize.height - (contentOffset.y + layoutMeasurement.height);
    const offsetMoved = contentOffset.y !== lastOffsetYRef.current;
    lastOffsetYRef.current = contentOffset.y;

    // A page appended (the end moved away). Re-arm the gate so the next user
    // scroll toward the end fetches again. Content-size-only events (offset
    // unchanged) never fetch on their own — that is what turned the old
    // onEndReached flow into a loop on sources that never return an empty
    // page (measured: htmlparser2 hot on every frame).
    if (contentSize.height !== lastContentHeightRef.current) {
      lastContentHeightRef.current = contentSize.height;
      if (offsetMoved) {
        lastFetchDistanceRef.current = Infinity;
      }
    }
    if (!offsetMoved) {
      return;
    }
    if (
      distanceFromEnd < layoutMeasurement.height * 1.5 &&
      distanceFromEnd < lastFetchDistanceRef.current
    ) {
      lastFetchDistanceRef.current = distanceFromEnd;
      if (searchText) {
        if (hasNextSearchPage) {
          searchNextPage();
        }
      } else if (hasNextPage) {
        fetchNextPage();
      }
    }
  };

  const showList =
    !(isLoading || isSearching) && !errorMessage && novelList.length > 0;

  const canFilter = !showLatestNovels && filterValues && !searchText;
  // Wide windows keep the filters open in a pane beside the results.
  const filterPane = Boolean(
    canFilter && layout.isExpanded && filterSheetVisible,
  );

  const results = (
    <NovelList
      availableWidth={filterPane ? layout.width - FILTER_PANE_WIDTH : undefined}
      data={novelList}
      inSource
      extraData={{ inActivity, novelInLibrary }}
      ListFooterComponent={
        (hasNextPage && !searchText) ||
        (hasNextSearchPage && Boolean(searchText)) ? (
          <SourceScreenSkeletonLoading theme={theme} completeRow={2} />
        ) : null
      }
      renderItem={({ item }) => {
        const inLibrary = novelInLibrary(pluginId, item.path);

        return (
          <NovelCover
            item={item}
            theme={theme}
            libraryStatus={inLibrary}
            inActivity={inActivity[item.path]}
            onPress={() => navigateToNovel(item)}
            isSelected={false}
            addSkeletonLoading={
              (hasNextPage && !searchText) ||
              (hasNextSearchPage && Boolean(searchText))
            }
            onLongPress={async () => {
              setInActivity(prev => ({ ...prev, [item.path]: true }));

              await switchNovelToLibrary(item.path, pluginId);

              setInActivity(prev => ({ ...prev, [item.path]: false }));
            }}
            hasSelection={false}
            imageRequestInit={imageRequestInit}
          />
        );
      }}
      onScroll={handleScroll}
    />
  );

  const content =
    isLoading || isSearching ? (
      <SourceScreenSkeletonLoading theme={theme} />
    ) : errorMessage || novelList.length === 0 ? (
      <ErrorScreenV2
        error={errorMessage || getString('sourceScreen.noResultsFound')}
        actions={[
          {
            iconName: RefreshIcon,
            title: getString('common.retry'),
            onPress: () => {
              if (searchText) {
                searchSource(searchText);
              } else {
                refetchNovels();
              }
            },
          },
        ]}
      />
    ) : null;

  return (
    <Screen
      topBar={
        <Column modifiers={[fillMaxWidth()]}>
          <SearchbarV2
            searchText={searchText}
            leftIcon={SearchIcon}
            placeholder={`${getString('common.search')} ${pluginName}`}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmitEditing}
            clearSearchbar={handleClearSearchbar}
            handleBackAction={navigation.goBack}
            rightIcons={[{ iconName: PublicIcon, onPress: handleOpenWebView }]}
            theme={theme}
          />
          {!searchText ? (
            <SegmentedControl
              options={[
                { label: getString('browseScreen.popular'), value: 'popular' },
                { label: getString('browseScreen.latest'), value: 'latest' },
              ]}
              value={showLatestNovels ? 'latest' : 'popular'}
              onChange={listing =>
                onShowLatestNovelsChange(listing === 'latest')
              }
              theme={theme}
              modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}
            />
          ) : null}
        </Column>
      }
      list={
        filterPane && filterValues ? (
          <View style={styles.panes}>
            <View style={styles.results}>
              {showList ? results : <ScreenContent>{content}</ScreenContent>}
            </View>
            <AppHost style={styles.filterPane}>
              <Column modifiers={[fillMaxSize(), verticalScroll()]}>
                <FilterBottomSheet
                  inline
                  visible
                  onDismiss={closeFilterSheet}
                  filters={filterValues}
                  setFilters={setFilters}
                  clearFilters={clearFilters}
                />
              </Column>
            </AppHost>
          </View>
        ) : showList ? (
          results
        ) : undefined
      }
      floatingAction={
        canFilter ? (
          <Fab
            extended
            icon={FilterListIcon}
            label={getString('common.filter')}
            onPress={layout.isExpanded ? toggleFilterSheet : openFilterSheet}
          />
        ) : undefined
      }
      overlays={
        canFilter && filterValues && !layout.isExpanded ? (
          <FilterBottomSheet
            visible={filterSheetVisible}
            onDismiss={closeFilterSheet}
            filters={filterValues}
            setFilters={setFilters}
            clearFilters={clearFilters}
          />
        ) : undefined
      }
    >
      {filterPane ? null : content}
    </Screen>
  );
};

// The source hooks load one listing each, so switching remounts the screen.
const BrowseSourceListingScreen = (props: BrowseSourceScreenProps) => {
  const [showLatestNovels, setShowLatestNovels] = useState(
    Boolean(props.route.params.showLatestNovels),
  );
  return (
    <BrowseSourceScreen
      key={showLatestNovels ? 'latest' : 'popular'}
      {...props}
      route={{
        ...props.route,
        params: { ...props.route.params, showLatestNovels },
      }}
      onShowLatestNovelsChange={setShowLatestNovels}
    />
  );
};

export default BrowseSourceListingScreen;

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row' },
  results: { flex: 1 },
  filterPane: { width: FILTER_PANE_WIDTH },
});
