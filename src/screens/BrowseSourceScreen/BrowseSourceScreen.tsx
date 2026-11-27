import { useCallback, useMemo, useRef, useState } from 'react';

import { Button, FAB } from 'react-native-paper';
import { ErrorScreenV2, SafeAreaView, SearchbarV2 } from '@components/index';
import NovelList from '@components/NovelList';
import NovelCover from '@components/NovelCover';
import { BottomSheetRef } from '@components/BottomSheet/BottomSheet';
import FilterBottomSheet from './components/FilterBottomSheet';

import { useSearch } from '@hooks';
import { useTheme } from '@hooks/persisted';
import { useBrowseSource, useSearchSource } from './useBrowseSource';

import { NovelItem } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import { getString } from '@i18n/translations';
import { StyleSheet, Text, View } from 'react-native';
import { NovelInfo } from '@database/types';
import SourceScreenSkeletonLoading from '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrowseSourceScreenProps } from '@navigators/types';
import { useLibraryContext } from '@components/Context/LibraryContext';

const BrowseSourceScreen = ({ route, navigation }: BrowseSourceScreenProps) => {
  const theme = useTheme();
  const skeletonTint = theme.isDark ? theme.primary : undefined;
  const { pluginId, pluginName, site, showLatestNovels } = route.params;
  const imageRequestInit = getPlugin(pluginId)?.imageRequestInit;

  const browse = useBrowseSource(pluginId, showLatestNovels);
  const search = useSearchSource(pluginId);
  const submittedQuery = search.page?.params;
  const { page, fetchNextPage, retryPage } = submittedQuery ? search : browse;
  const error = page?.error;
  const hasError = error !== undefined;
  const canFetchNextPage =
    page?.nextPage != null && !page.isLoading && !hasError;
  const lastFetchDistanceRef = useRef(Infinity);
  const lastScrolledNovelsRef = useRef<NovelItem[]>(null);
  const lastOffsetYRef = useRef(-1);

  const { searchText, setSearchText, clearSearchbar } = useSearch(
    undefined,
    false,
  );
  const resetScrollGate = () => {
    lastFetchDistanceRef.current = Infinity;
    lastScrolledNovelsRef.current = null;
    lastOffsetYRef.current = -1;
  };
  const clearSearch = () => {
    search.clearSearchResults();
    resetScrollGate();
  };
  const onChangeText = (text: string) => {
    setSearchText(text);
    if (!text) {
      clearSearch();
    }
  };
  const onSubmitEditing = () => {
    resetScrollGate();
    search.searchSource(searchText);
  };
  const handleClearSearchbar = () => {
    clearSearchbar();
    clearSearch();
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
  const listExtraData = useMemo(
    () => ({ inActivity, novelInLibrary }),
    [inActivity, novelInLibrary],
  );

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

  const { bottom, right } = useSafeAreaInsets();
  const filterSheetRef = useRef<BottomSheetRef | null>(null);
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

    // Require movement for scroll-based prefetch. New results re-arm the gate
    // on the next scroll.
    if (!offsetMoved) {
      return;
    }
    if (page && page.novels !== lastScrolledNovelsRef.current) {
      lastScrolledNovelsRef.current = page.novels;
      lastFetchDistanceRef.current = Infinity;
    }
    if (
      canFetchNextPage &&
      distanceFromEnd < layoutMeasurement.height * 1.5 &&
      distanceFromEnd < lastFetchDistanceRef.current
    ) {
      lastFetchDistanceRef.current = distanceFromEnd;
      fetchNextPage();
    }
  };
  return (
    <SafeAreaView>
      <SearchbarV2
        searchText={searchText}
        leftIcon="magnify"
        placeholder={`${getString('common.search')} ${pluginName}`}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
        clearSearchbar={handleClearSearchbar}
        handleBackAction={navigation.goBack}
        rightIcons={[{ iconName: 'earth', onPress: handleOpenWebView }]}
        theme={theme}
      />
      {!page || (page.isLoading && page.novels.length === 0) ? (
        <SourceScreenSkeletonLoading theme={theme} tintColor={skeletonTint} />
      ) : page.novels.length === 0 ? (
        <ErrorScreenV2
          error={error ?? getString('sourceScreen.noResultsFound')}
          actions={
            hasError
              ? [
                  {
                    iconName: 'refresh',
                    title: getString('common.retry'),
                    onPress: retryPage,
                  },
                ]
              : undefined
          }
        />
      ) : (
        <NovelList
          data={page.novels}
          extraData={listExtraData}
          // Idle fillers could hide changes to the result count within a row.
          inSource={page.isLoading}
          ListFooterComponent={
            hasError ? (
              <View style={styles.pageError}>
                <Text
                  style={[
                    styles.pageErrorText,
                    { color: theme.onSurfaceVariant },
                  ]}
                >
                  {error}
                </Text>
                <Button icon="refresh" onPress={retryPage}>
                  {getString('common.retry')}
                </Button>
              </View>
            ) : page.isLoading ? (
              <SourceScreenSkeletonLoading
                theme={theme}
                completeRow={2}
                tintColor={skeletonTint}
              />
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
                addSkeletonLoading={page.isLoading}
                skeletonTint={skeletonTint}
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
          // LegendList's zero threshold dispatches only for content shorter
          // than the viewport. Scrollable lists use the scroll gate above.
          onEndReachedThreshold={0}
          onEndReached={canFetchNextPage ? fetchNextPage : undefined}
          onScroll={handleScroll}
          scrollEventThrottle={32}
        />
      )}
      {!showLatestNovels && browse.filterValues && !submittedQuery ? (
        <>
          <FAB
            icon={'filter-variant'}
            style={[
              styles.filterFab,
              {
                backgroundColor: theme.primary,
                marginBottom: bottom + 16,
                marginEnd: right + 16,
              },
            ]}
            label={getString('common.filter')}
            uppercase={false}
            color={theme.onPrimary}
            onPress={() => filterSheetRef?.current?.present()}
          />
          <FilterBottomSheet
            filterSheetRef={filterSheetRef}
            filters={browse.filterValues}
            pluginId={pluginId}
            setFilters={browse.setFilters}
            clearFilters={browse.clearFilters}
          />
        </>
      ) : null}
    </SafeAreaView>
  );
};

export default BrowseSourceScreen;

const styles = StyleSheet.create({
  pageError: {
    alignItems: 'center',
    padding: 16,
  },
  pageErrorText: {
    textAlign: 'center',
  },
  filterFab: {
    bottom: 0,
    margin: 16,
    position: 'absolute',
    end: 0,
  },
});
