import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { TextInput, TouchableRipple } from 'react-native-paper';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import { FlashList } from '@shopify/flash-list';

import { Dialog, NovelCoverImage } from '@components';
import { getTracker, useTheme } from '@hooks/persisted';
import { getString } from '@strings/translations';
import { SearchResult } from '@services/Trackers';
import { TrackSearchDialogProps } from './types';
import { showToast } from '@utils/showToast';
import { getErrorMessage } from '@utils/error';

const TrackSearchDialog: React.FC<TrackSearchDialogProps> = ({
  tracker,
  onTrackNovel,
  visible,
  onDismiss,
  novelName,
}) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchTextOverride, setSearchTextOverride] = useState<string>();
  const [selectedNovel, setSelectedNovel] = useState<SearchResult>();
  const latestRequestId = useRef(0);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchText = searchTextOverride ?? novelName;

  const getSearchResults = useCallback(
    async (query: string) => {
      const normalizedQuery = query.trim();
      const requestId = ++latestRequestId.current;

      if (!normalizedQuery) {
        setLoading(false);
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        const trackerObj = getTracker(tracker.name);
        const results = await trackerObj.handleSearch(
          normalizedQuery,
          tracker.auth,
        );

        if (requestId === latestRequestId.current) {
          setSearchResults(results);
        }
      } catch (error) {
        if (requestId === latestRequestId.current) {
          showToast(
            `Failed to fetch search results from ${
              tracker.name
            }: ${getErrorMessage(error)}`,
          );
          setSearchResults([]);
        }
      } finally {
        if (requestId === latestRequestId.current) {
          setLoading(false);
        }
      }
    },
    [tracker.auth, tracker.name],
  );

  const cancelScheduledSearch = useCallback(() => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
      searchTimer.current = null;
    }
  }, []);

  const scheduleSearch = useCallback(
    (query: string) => {
      cancelScheduledSearch();
      latestRequestId.current += 1;
      searchTimer.current = setTimeout(() => {
        void getSearchResults(query);
      }, 350);
    },
    [cancelScheduledSearch, getSearchResults],
  );

  useEffect(
    () => () => {
      cancelScheduledSearch();
      latestRequestId.current += 1;
    },
    [cancelScheduledSearch],
  );

  useEffect(() => {
    if (!visible) {
      cancelScheduledSearch();
      latestRequestId.current += 1;
      return;
    }

    scheduleSearch(novelName);
  }, [cancelScheduledSearch, novelName, scheduleSearch, visible]);

  const handleSearchTextChange = useCallback(
    (value: string) => {
      setSearchTextOverride(value);
      setSelectedNovel(undefined);
      scheduleSearch(value);
    },
    [scheduleSearch],
  );

  const handleSubmitSearch = useCallback(() => {
    cancelScheduledSearch();
    void getSearchResults(searchText);
  }, [cancelScheduledSearch, getSearchResults, searchText]);

  const handleClearSearch = useCallback(() => {
    cancelScheduledSearch();
    latestRequestId.current += 1;
    setSearchTextOverride('');
    setSearchResults([]);
    setLoading(false);
  }, [cancelScheduledSearch]);

  const handleDismiss = useCallback(() => {
    cancelScheduledSearch();
    latestRequestId.current += 1;
    setSearchTextOverride(undefined);
    setSelectedNovel(undefined);
    onDismiss();
  }, [cancelScheduledSearch, onDismiss]);

  const handleSelectNovel = useCallback((item: SearchResult) => {
    setSelectedNovel(item);
  }, []);

  const handleRemoveSelection = useCallback(() => {
    setSelectedNovel(undefined);
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedNovel) {
      onTrackNovel(tracker, selectedNovel);
    }
    handleDismiss();
  }, [selectedNovel, onTrackNovel, tracker, handleDismiss]);

  const renderSearchResultCard = useCallback(
    (item: SearchResult) => {
      const isSelected = selectedNovel?.id === item.id;

      return (
        <TouchableRipple
          style={[
            styles.searchResultCard,
            isSelected && {
              backgroundColor: theme.rippleColor,
            },
          ]}
          key={item.id}
          onPress={() => handleSelectNovel(item)}
          rippleColor={theme.rippleColor}
          borderless
        >
          <>
            {isSelected && (
              <MaterialCommunityIcons
                name="check-circle"
                color={theme.primary}
                size={24}
                style={styles.checkIcon}
              />
            )}
            <NovelCoverImage
              uri={item.coverImage}
              theme={theme}
              iconSize={28}
              style={styles.coverImage}
            />
            <Text
              style={[styles.resultText, { color: theme.onSurface }]}
              numberOfLines={3}
            >
              {item.title}
            </Text>
          </>
        </TouchableRipple>
      );
    },
    [selectedNovel, handleSelectNovel, theme],
  );

  return (
    <Dialog.Root visible={visible} onDismiss={handleDismiss}>
      <Dialog.Title>{tracker.name}</Dialog.Title>
      <Dialog.Content>
        <TextInput
          value={searchText}
          onChangeText={handleSearchTextChange}
          onSubmitEditing={handleSubmitSearch}
          textColor={theme.onSurface}
          theme={{
            colors: {
              primary: theme.primary,
              text: theme.onSurface,
            },
          }}
          style={styles.textInput}
          underlineColor={theme.outline}
          right={
            <TextInput.Icon
              color={theme.onSurfaceVariant}
              icon="close"
              onPress={handleClearSearch}
            />
          }
        />
      </Dialog.Content>
      <Dialog.ScrollArea>
        <FlashList
          data={loading ? [] : searchResults}
          keyExtractor={item => item.id.toString()}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator
                color={theme.primary}
                size={45}
                style={styles.loader}
              />
            ) : null
          }
          renderItem={({ item }) => renderSearchResultCard(item)}
          style={styles.resultsList}
        />
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action
          title={getString('common.remove')}
          onPress={handleRemoveSelection}
        />
        <Dialog.Action
          title={getString('common.cancel')}
          onPress={handleDismiss}
        />
        <Dialog.Action title="OK" onPress={handleConfirm} />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default TrackSearchDialog;

const styles = StyleSheet.create({
  checkIcon: {
    position: 'absolute',
    right: 8,
    top: 8,
    zIndex: 1,
  },
  coverImage: {
    borderRadius: 4,
    height: 150,
    width: 100,
  },
  loader: {
    margin: 16,
  },
  resultText: {
    flex: 1,
    flexWrap: 'wrap',
    fontSize: 16,
    marginLeft: 20,
    padding: 8,
    paddingLeft: 0,
  },
  resultsList: {
    flexGrow: 1,
    marginVertical: 8,
    maxHeight: 500,
  },
  searchResultCard: {
    borderRadius: 4,
    flexDirection: 'row',
    margin: 8,
  },
  textInput: {
    backgroundColor: 'transparent',
  },
});
