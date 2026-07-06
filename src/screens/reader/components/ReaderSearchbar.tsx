import React, { useCallback, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconButtonV2 } from '@components';
import { ThemeColors } from '@theme/types';
import { useChapterContext } from '../ChapterContext';
import { ReaderSearchResult } from '../types';

interface ReaderSearchbarProps {
  theme: ThemeColors;
  searchText: string;
  setSearchText: (text: string) => void;
  searchResult: ReaderSearchResult;
  resetSearchResult: () => void;
  resetSearch: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const ReaderSearchbar = ({
  theme,
  searchText,
  setSearchText,
  searchResult,
  resetSearchResult,
  resetSearch,
}: ReaderSearchbarProps) => {
  const inputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { searchChapterText, clearChapterSearch, navigateChapterSearch } =
    useChapterContext();
  const hasSearchText = searchText.trim().length > 0;
  const hasMatches = hasSearchText && searchResult.total > 0;

  const clearPendingSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
      searchTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());

    return () => {
      cancelAnimationFrame(frame);
      clearPendingSearch();
      Keyboard.dismiss();
      resetSearch();
      clearChapterSearch();
    };
  }, [clearChapterSearch, clearPendingSearch, resetSearch]);

  const handleSearchTextChange = useCallback(
    (text: string) => {
      setSearchText(text);
      resetSearchResult();
      clearPendingSearch();

      if (!text.trim()) {
        clearChapterSearch();
        return;
      }

      searchTimeoutRef.current = setTimeout(() => {
        searchChapterText(text);
        searchTimeoutRef.current = null;
      }, SEARCH_DEBOUNCE_MS);
    },
    [
      clearChapterSearch,
      clearPendingSearch,
      resetSearchResult,
      searchChapterText,
      setSearchText,
    ],
  );

  const handleClearSearch = useCallback(() => {
    clearPendingSearch();
    resetSearch();
    clearChapterSearch();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [clearChapterSearch, clearPendingSearch, resetSearch]);

  const handleSubmitEditing = useCallback(() => {
    clearPendingSearch();
    if (hasMatches) {
      navigateChapterSearch('NEXT', searchText);
      return;
    }
    if (hasSearchText) {
      searchChapterText(searchText);
    }
  }, [
    clearPendingSearch,
    hasMatches,
    hasSearchText,
    navigateChapterSearch,
    searchChapterText,
    searchText,
  ]);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchbar,
          { backgroundColor: theme.surface2 || theme.surface },
        ]}
      >
        <IconButtonV2
          name="magnify"
          color={theme.onSurfaceVariant}
          onPress={() => inputRef.current?.focus()}
          padding={6}
          theme={theme}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={handleSearchTextChange}
          onSubmitEditing={handleSubmitEditing}
          placeholder="Search chapter"
          placeholderTextColor={theme.onSurfaceVariant}
          returnKeyType="search"
          selectionColor={theme.primary}
          style={[styles.input, { color: theme.onSurface }]}
          submitBehavior="submit"
          value={searchText}
        />
        {hasSearchText ? (
          <Text style={[styles.resultText, { color: theme.onSurfaceVariant }]}>
            {searchResult.current}/{searchResult.total}
          </Text>
        ) : null}
        <IconButtonV2
          name="chevron-up"
          color={theme.onSurface}
          disabled={!hasMatches}
          onPress={() => navigateChapterSearch('PREV', searchText)}
          padding={6}
          theme={theme}
        />
        <IconButtonV2
          name="chevron-down"
          color={theme.onSurface}
          disabled={!hasMatches}
          onPress={() => navigateChapterSearch('NEXT', searchText)}
          padding={6}
          style={styles.trailingButton}
          theme={theme}
        />
        {hasSearchText ? (
          <IconButtonV2
            name="close"
            color={theme.onSurface}
            onPress={handleClearSearch}
            padding={6}
            style={styles.trailingButton}
            theme={theme}
          />
        ) : null}
      </View>
    </View>
  );
};

export default ReaderSearchbar;

const styles = StyleSheet.create({
  trailingButton: {
    marginRight: 4,
  },
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    minHeight: 44,
    paddingVertical: 0,
  },
  resultText: {
    fontSize: 13,
    minWidth: 40,
    textAlign: 'center',
  },
  searchIcon: {
    marginLeft: 8,
  },
  searchbar: {
    alignItems: 'center',
    borderRadius: 24,
    flexDirection: 'row',
    minHeight: 48,
    overflow: 'hidden',
  },
});
