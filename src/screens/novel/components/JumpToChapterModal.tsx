import React, { useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  TextInput as RNTextInput,
} from 'react-native';
import { getString } from '@strings/translations';
import { Button, Modal, SwitchItem } from '@components';

import { Portal, Text } from 'react-native-paper';
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
} from '@legendapp/list';

interface JumpToChapterModalProps {
  hideModal: () => void;
  modalVisible: boolean;
  navigation: NovelScreenProps['navigation'];
  novel: NovelInfo;
  chapters: ChapterInfo[];
  chapterListRef: React.RefObject<LegendListRef | null>;
  loadUpToBatch: (batch: number) => Promise<void>;
  totalChapters?: number;
}

const JumpToChapterModal = ({
  hideModal,
  modalVisible,
  chapters: loadedChapters,
  navigation,
  novel,
  chapterListRef,
  loadUpToBatch,
  totalChapters,
}: JumpToChapterModalProps) => {
  const minNumber = 1;
  const maxNumber = totalChapters ?? -1;
  const theme = useTheme();
  const [mode, setMode] = useState(false);
  const [openChapter, setOpenChapter] = useState(false);

  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ChapterInfo[]>([]);

  const inputRef = useRef<RNTextInput>(null);
  const [inputFocused, setInputFocused] = useState(false);

  const onDismiss = () => {
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
    onDismiss();
    const loadedIndex = loadedChapters.findIndex(c => c.id === chap.id);
    if (loadedIndex >= 0) {
      chapterListRef.current?.scrollToIndex({
        animated: true,
        index: loadedIndex,
        viewPosition: 0.5,
      });
      return;
    }

    if ((chap.position ?? -1) >= 0) {
      const targetBatch = Math.floor(chap.position! / 300);
      await loadUpToBatch(targetBatch);
      setTimeout(() => {
        chapterListRef.current?.scrollToIndex({
          animated: true,
          index: chap.position!,
          viewPosition: 0.5,
        });
      }, 0);
    }
  };

  const executeFunction = (item: ChapterInfo) => {
    if (openChapter) {
      navigateToChapter(item);
    } else {
      scrollToChapter(item);
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
    if (!mode) {
      // Number search
      const num = Number(text);
      if (num && num >= minNumber && num <= maxNumber) {
        const chapters = await getNovelChaptersByNumber(novel!.id, num);
        if (chapters.length > 0) {
          const chapter = chapters[0];
          if (openChapter) {
            return navigateToChapter(chapter);
          } else {
            return scrollToChapter(chapter);
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
        novel!.id,
        text.toLowerCase(),
      );
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
          return scrollToChapter(chapters[0]);
        }
      }

      return setResult(chapters);
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
    <Portal>
      <Modal visible={modalVisible} onDismiss={onDismiss}>
        <View>
          <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
            {getString('novelScreen.jumpToChapterModal.jumpToChapter')}
          </Text>
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
          {!!error && (
            <Text style={[styles.errorText, { color: errorColor }]}>
              {error}
            </Text>
          )}
          <SwitchItem
            label={getString('novelScreen.jumpToChapterModal.openChapter')}
            value={openChapter}
            theme={theme}
            onPress={() => setOpenChapter(!openChapter)}
            size={20}
          />
          <SwitchItem
            label={getString('novelScreen.jumpToChapterModal.chapterName')}
            value={mode}
            theme={theme}
            onPress={() => setMode(!mode)}
            size={20}
          />
        </View>
        {result.length ? (
          <View style={[styles.flashlist, { borderColor: theme.outline }]}>
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
        ) : null}
        <View style={styles.modalFooterCtn}>
          <Button title={getString('common.submit')} onPress={onSubmit} />
          <Button title={getString('common.cancel')} onPress={hideModal} />
        </View>
      </Modal>
    </Portal>
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
  flashlist: {
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
  modalFooterCtn: {
    flexDirection: 'row-reverse',
    paddingTop: 8,
  },
  modalTitle: {
    fontSize: 24,
    marginBottom: 16,
  },
  textInput: {
    borderRadius: 4,
    borderStyle: 'solid',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
});
