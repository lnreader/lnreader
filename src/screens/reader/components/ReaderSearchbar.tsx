import { useEffect, useRef, useState } from 'react';
import { Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  height,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { useTheme } from '@hooks/persisted/useTheme';
import { getString } from '@i18n/translations';
import { useChapterContext } from '../ChapterContext';
import KeyboardArrowDownIcon from '@expo/material-symbols/keyboard_arrow_down.xml';
import KeyboardArrowUpIcon from '@expo/material-symbols/keyboard_arrow_up.xml';
import SearchIcon from '@expo/material-symbols/search.xml';
import { IconButtonV2, AppText, TextInput } from '@components';

export const SEARCH_HEIGHT = 72;

const SEARCH_DEBOUNCE_MS = 300;

const MIN_SEARCH_LENGTH = 3;

const SPECIAL_CHARACTER = /[^\p{L}\p{N}\s]/u;

const ReaderSearchbar = ({ initialQuery }: { initialQuery: string }) => {
  const theme = useTheme();
  const { search } = useChapterContext();
  const [text, setText] = useState(initialQuery);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = text.trim();
  const blocked =
    query.length > 0 &&
    query.length < MIN_SEARCH_LENGTH &&
    !SPECIAL_CHARACTER.test(query);
  const hasMatches =
    search.result.query.trim() === query && search.result.total > 0;
  const { clear, run } = search;

  useEffect(() => {
    if (initialQuery.trim()) {
      run(initialQuery);
    }
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      clear();
    };
    // Runs once per opening of the search row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChange = (value: string) => {
    setText(value);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    const normalized = value.trim();
    if (
      !normalized ||
      (normalized.length < MIN_SEARCH_LENGTH &&
        !SPECIAL_CHARACTER.test(normalized))
    ) {
      clear();
      return;
    }
    timer.current = setTimeout(() => run(value), SEARCH_DEBOUNCE_MS);
  };

  return (
    <Row
      verticalAlignment="center"
      modifiers={[fillMaxWidth(), height(SEARCH_HEIGHT), padding(12, 0, 4, 8)]}
    >
      <TextInput
        value={text}
        onChangeText={onChange}
        placeholder={getString('readerScreen.searchPlaceholder')}
        leadingIcon={SearchIcon}
        autoFocus={!initialQuery}
        imeAction="search"
        onSubmit={() => {
          if (hasMatches) {
            search.step(1);
          } else if (query && !blocked) {
            run(text);
          }
        }}
        supportingText={
          blocked
            ? getString('readerScreen.searchMinLength', {
                count: MIN_SEARCH_LENGTH,
              })
            : undefined
        }
        trailing={
          query && !blocked ? (
            <AppText variant="labelMedium" color={theme.onSurfaceVariant}>
              {`${search.result.current}/${search.result.total}`}
            </AppText>
          ) : undefined
        }
        modifiers={[weight(1)]}
      />
      <IconButtonV2
        name={KeyboardArrowUpIcon}
        accessibilityLabel={getString('common.previous')}
        disabled={!hasMatches}
        onPress={() => search.step(-1)}
        theme={theme}
      />
      <IconButtonV2
        name={KeyboardArrowDownIcon}
        accessibilityLabel={getString('common.next')}
        disabled={!hasMatches}
        onPress={() => search.step(1)}
        theme={theme}
      />
    </Row>
  );
};

export default ReaderSearchbar;
