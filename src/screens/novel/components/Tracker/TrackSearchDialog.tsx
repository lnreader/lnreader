import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Row } from '@expo/ui/jetpack-compose';
import {
  align,
  background,
  clickable,
  clip,
  fillMaxWidth,
  padding,
  Shapes,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import {
  AppIcon,
  AppText,
  Dialog,
  IconButtonV2,
  NovelCoverImage,
  ProgressIndicator,
  TextInput,
} from '@components';
import { getTracker, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { SearchResult } from '@services/Trackers';
import { TrackSearchDialogProps } from './types';
import { showToast } from '@utils/showToast';
import { getErrorMessage } from '@utils/error';
import CheckCircleIcon from '@expo/material-symbols/check_circle.xml';
import CloseIcon from '@expo/material-symbols/close.xml';

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

    cancelScheduledSearch();
    searchTimer.current = setTimeout(() => {
      void getSearchResults(novelName);
    }, 0);
  }, [cancelScheduledSearch, getSearchResults, novelName, visible]);

  const handleSearchTextChange = useCallback(
    (value: string) => {
      setSearchTextOverride(value);
      setSelectedNovel(undefined);
      scheduleSearch(value);
    },
    [scheduleSearch],
  );

  const handleSubmitSearch = useCallback(
    (text: string) => {
      cancelScheduledSearch();
      void getSearchResults(text);
    },
    [cancelScheduledSearch, getSearchResults],
  );

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
        <Box key={item.id} modifiers={[fillMaxWidth(), padding(8, 8, 8, 8)]}>
          <Row
            modifiers={[
              fillMaxWidth(),
              clip(Shapes.RoundedCorner(4)),
              ...(isSelected
                ? [background(theme.rippleColor ?? theme.surfaceVariant)]
                : []),
              clickable(() => handleSelectNovel(item)),
            ]}
          >
            <NovelCoverImage
              uri={item.coverImage}
              width={100}
              height={150}
              corner={4}
              theme={theme}
            />
            <AppText
              variant="bodyLarge"
              color={theme.onSurface}
              maxLines={3}
              modifiers={[weight(1), padding(20, 8, 8, 8)]}
            >
              {item.title}
            </AppText>
          </Row>
          {isSelected && (
            <Box modifiers={[align('topEnd'), padding(0, 8, 8, 0)]}>
              <AppIcon source={CheckCircleIcon} tint={theme.primary} />
            </Box>
          )}
        </Box>
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
          onSubmit={handleSubmitSearch}
          imeAction="search"
          testID="tracker-search-input"
          trailing={
            <IconButtonV2
              name={CloseIcon}
              color={theme.onSurfaceVariant}
              onPress={handleClearSearch}
              theme={theme}
            />
          }
        />
      </Dialog.Content>
      <Dialog.ScrollArea fixed>
        {loading ? (
          <Box
            contentAlignment="center"
            modifiers={[fillMaxWidth(), padding(16, 16, 16, 16)]}
          >
            <ProgressIndicator circular />
          </Box>
        ) : (
          searchResults.map(item => renderSearchResultCard(item))
        )}
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
