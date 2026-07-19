import React, { useCallback, useEffect, useRef } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, View } from 'react-native';

import { IconButtonV2 } from '@components';
import { ThemeColors } from '@theme/types';
import { useChapterContext } from '../ChapterContext';
import { ReaderSearchResult } from '../types';
import { getString } from '@strings/translations';

interface ReaderSearchbarProps {
  theme: ThemeColors;
  searchText: string;
  setSearchText: (text: string) => void;
  searchResult: ReaderSearchResult;
  resetSearchResult: () => void;
  resetSearch: () => void;
}

const SEARCH_DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 3;
const SPECIAL_CHARACTER_REGEX = /[^\p{L}\p{N}\s]/u;

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
  const normalizedSearchText = searchText.trim();
  const hasSearchText = normalizedSearchText.length > 0;
  const hasSpecialCharacter =
    SPECIAL_CHARACTER_REGEX.test(normalizedSearchText);
  const isSearchBlocked =
    hasSearchText &&
    normalizedSearchText.length < MIN_SEARCH_LENGTH &&
    !hasSpecialCharacter;
  const hasCurrentSearchResult = searchResult.query === normalizedSearchText;
  const hasMatches = hasCurrentSearchResult && searchResult.renderedTotal > 0;
  const resultTotalText = searchResult.isTruncated
    ? `${searchResult.renderedTotal}+`
    : String(searchResult.total);

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

      const normalizedText = text.trim();

      const containsSpecialCharacter =
        SPECIAL_CHARACTER_REGEX.test(normalizedText);

      if (
        !normalizedText ||
        (normalizedText.length < MIN_SEARCH_LENGTH && !containsSpecialCharacter)
      ) {
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
    if (isSearchBlocked) {
      clearChapterSearch();
      return;
    }

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
    isSearchBlocked,
    clearChapterSearch,
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
          placeholder={getString('readerScreen.searchPlaceholder')}
          placeholderTextColor={theme.onSurfaceVariant}
          returnKeyType="search"
          selectionColor={theme.primary}
          style={[styles.input, { color: theme.onSurface }]}
          submitBehavior="submit"
          value={searchText}
        />
        {hasSearchText && !isSearchBlocked ? (
          <Text style={[styles.resultText, { color: theme.onSurfaceVariant }]}>
            {searchResult.current}/{resultTotalText}
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
      {isSearchBlocked ? (
        <Text
          style={[styles.helperText, { color: theme.onSurfaceVariant }]}
          numberOfLines={1}
        >
          {getString('readerScreen.searchMinLength', {
            count: MIN_SEARCH_LENGTH,
          })}
        </Text>
      ) : null}
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
  helperText: {
    fontSize: 12,
    marginTop: 4,
    paddingHorizontal: 12,
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
