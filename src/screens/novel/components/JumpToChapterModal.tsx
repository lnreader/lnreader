import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  TextInput as RNTextInput,
} from 'react-native';
import { getString } from '@i18n/translations';
import { Dialog, SwitchItem } from '@components';

import { Text } from 'react-native-paper';
import { useTheme } from '@hooks/persisted';
import { ChapterInfo, NovelInfo } from '@database/types';
import { NovelScreenProps } from '@navigators/types';
import {
  getNovelChaptersByNumber,
  getNovelChaptersByName,
} from '@database/queries/ChapterQueries';
import {
  LegendList,
  LegendListRef,
  LegendListRenderItemProps,
} from '@legendapp/list/react-native';
import { useNovelAction, useNovelValue } from '../NovelContext';
import { CHAPTER_BATCH_SIZE } from '@hooks/persisted/useNovel/store-helper/bootstrapService';

interface JumpToChapterModalProps {
  hideModal: () => void;
  modalVisible: boolean;
  navigation: NovelScreenProps['navigation'];
  novel: NovelInfo;
  chapterListRef: React.RefObject<LegendListRef | null>;
}

const JumpToChapterModal = ({
  hideModal,
  modalVisible,
  navigation,
  novel,
  chapterListRef,
}: JumpToChapterModalProps) => {
  const minNumber = 1;

  const loadedChapters = useNovelValue('chapters');
  const loadedChaptersRef = useRef(loadedChapters);
  useEffect(() => {
    loadedChaptersRef.current = loadedChapters;
  }, [loadedChapters]);
  const requestIdRef = useRef(0);
  const batchInformation = useNovelValue('batchInformation');
  const loadUpToBatch = useNovelAction('loadUpToBatch');

  const maxNumber = batchInformation.totalChapters ?? -1;
  const theme = useTheme();
  const [mode, setMode] = useState(false);
  const [openChapter, setOpenChapter] = useState(false);

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ChapterInfo[]>([]);

  const inputRef = useRef<RNTextInput>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const onDismiss = () => {
    requestIdRef.current += 1;
    hideModal();
    setText('');
    inputRef.current?.clear();
    inputRef.current?.blur();
    setInputFocused(false);
    setError('');
    setResult([]);
  };
  const navigateToChapter = (chap: ChapterInfo) => {
    onDismiss();
    navigation.navigate('Chapter', {
      novel: novel,
      chapter: chap,
    });
  };

  const scrollToChapter = async (chap: ChapterInfo) => {
    const loadedIndex = loadedChapters.findIndex(c => c.id === chap.id);
    if (loadedIndex >= 0) {
      onDismiss();
      chapterListRef.current?.scrollToIndex({
        animated: true,
        index: loadedIndex,
        viewPosition: 0.5,
      });
      return;
    }

    if ((chap.position ?? -1) >= 0) {
      const requestId = ++requestIdRef.current;
      try {
        const targetBatch = Math.floor(
          (chap.position ?? 0) / CHAPTER_BATCH_SIZE,
        );
        await loadUpToBatch(targetBatch);
        if (requestId !== requestIdRef.current) {
          return;
        }
        setTimeout(() => {
          if (requestId !== requestIdRef.current) {
            return;
          }
          const resolvedIndex = loadedChaptersRef.current.findIndex(
            chapter => chapter.id === chap.id,
          );
          if (resolvedIndex < 0) {
            setError(
              getString(
                'novelScreen.jumpToChapterModal.error.validChapterNumber',
              ),
            );
            return;
          }
          onDismiss();
          chapterListRef.current?.scrollToIndex({
            animated: true,
            index: resolvedIndex,
            viewPosition: 0.5,
          });
        }, 0);
      } catch (loadError) {
        if (requestId === requestIdRef.current) {
          setError(
            loadError instanceof Error ? loadError.message : String(loadError),
          );
        }
      }
    }
  };

  const executeFunction = (item: ChapterInfo) => {
    if (openChapter) {
      navigateToChapter(item);
    } else {
      void scrollToChapter(item);
    }
  };

  const renderItem = ({ item }: LegendListRenderItemProps<ChapterInfo>) => {
    return (
      <Pressable
        android_ripple={{ color: theme.rippleColor }}
        onPress={() => executeFunction(item)}
        style={styles.listElementContainer}
      >
        <Text numberOfLines={1} style={{ color: theme.onSurface }}>
          {item.name}
        </Text>
        {item?.releaseTime ? (
          <Text
            numberOfLines={1}
            style={[{ color: theme.onSurfaceVariant }, styles.dateCtn]}
          >
            {item.releaseTime}
          </Text>
        ) : null}
      </Pressable>
    );
  };

  const onSubmit = async () => {
    const requestId = ++requestIdRef.current;
    setError('');
    try {
      if (!mode) {
        // Number search
        const num = Number(text);
        if (num && num >= minNumber && num <= maxNumber) {
          const chapters = await getNovelChaptersByNumber(novel.id, num);
          if (requestId !== requestIdRef.current) {
            return;
          }
          if (chapters.length > 0) {
            const chapter = chapters[0];
            if (openChapter) {
              return navigateToChapter(chapter);
            } else {
              return await scrollToChapter(chapter);
            }
          }
        }

        return setError(
          getString('novelScreen.jumpToChapterModal.error.validChapterNumber') +
            ` (${num < minNumber ? '≥ ' + minNumber : '≤ ' + maxNumber})`,
        );
      } else {
        // Text search
        const chapters = await getNovelChaptersByName(
          novel.id,
          text.toLowerCase(),
        );
        if (requestId !== requestIdRef.current) {
          return;
        }
        if (!chapters.length) {
          setError(
            getString('novelScreen.jumpToChapterModal.error.validChapterName'),
          );
          return;
        }

        if (chapters.length === 1) {
          if (openChapter) {
            return navigateToChapter(chapters[0]);
          } else {
            return await scrollToChapter(chapters[0]);
          }
        }

        return setResult(chapters);
      }
    } catch (searchError) {
      if (requestId === requestIdRef.current) {
        setError(
          searchError instanceof Error
            ? searchError.message
            : String(searchError),
        );
      }
    }
  };

  const onChangeText = (txt: string) => {
    setText(txt);
    setResult([]);
  };

  const errorColor = !theme.isDark ? '#B3261E' : '#F2B8B5';
  const placeholder = mode
    ? getString('novelScreen.jumpToChapterModal.chapterName')
    : getString('novelScreen.jumpToChapterModal.chapterNumber') +
      ` (≥ ${minNumber},  ≤ ${maxNumber})`;

  const borderWidth = inputFocused || error ? 2 : 1;
  const margin = inputFocused || error ? 0 : 1;
  return (
    <Dialog.Root visible={modalVisible} onDismiss={onDismiss}>
      <Dialog.Title>
        {getString('novelScreen.jumpToChapterModal.jumpToChapter')}
      </Dialog.Title>
      <Dialog.Content>
        <RNTextInput
          ref={inputRef}
          placeholder={placeholder}
          placeholderTextColor={'grey'}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          keyboardType={mode ? 'default' : 'numeric'}
          onFocus={() => setInputFocused(true)}
          onBlur={() => setInputFocused(false)}
          style={[
            {
              color: theme.onBackground,
              backgroundColor: theme.background,
              borderColor: error
                ? theme.error
                : inputFocused
                ? theme.primary
                : theme.outline,
              borderWidth: borderWidth,
              margin: margin,
            },
            styles.textInput,
          ]}
        />
        {error ? (
          <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
        ) : null}
      </Dialog.Content>
      <Dialog.List>
        <SwitchItem
          label={getString('novelScreen.jumpToChapterModal.openChapter')}
          value={openChapter}
          theme={theme}
          onPress={() => setOpenChapter(!openChapter)}
        />
        <SwitchItem
          label={getString('novelScreen.jumpToChapterModal.chapterName')}
          value={mode}
          theme={theme}
          onPress={() => setMode(!mode)}
        />
      </Dialog.List>
      {result.length ? (
        <Dialog.Content>
          <View style={[styles.legendlist, { borderColor: theme.outline }]}>
            <LegendList
              recycleItems
              estimatedItemSize={70}
              data={result}
              extraData={openChapter}
              renderItem={renderItem}
              keyExtractor={item => `chapter_${item.id}`}
              contentContainerStyle={styles.listContentCtn}
            />
          </View>
        </Dialog.Content>
      ) : null}
      <Dialog.Actions>
        <Dialog.Action onPress={hideModal}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={onSubmit}>
          {getString('common.submit')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default JumpToChapterModal;

const styles = StyleSheet.create({
  dateCtn: {
    fontSize: 12,
    marginTop: 2,
  },
  errorText: {
    paddingTop: 12,
  },
  legendlist: {
    borderBottomWidth: 1,
    borderTopWidth: 1,
    height: 300,
    marginTop: 8,
  },
  listContentCtn: {
    paddingVertical: 8,
  },
  listElementContainer: {
    paddingVertical: 12,
  },
  textInput: {
    borderRadius: 4,
    borderStyle: 'solid',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
