import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { getString } from '@i18n/translations';
import { Dialog, SwitchItem } from '@components';

import { HelperText, Text, TextInput } from 'react-native-paper';
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
  'no use memo';
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
  const [searching, setSearching] = useState(false);
  const inputTheme = useMemo(() => ({ colors: theme }), [theme]);

  const onDismiss = () => {
    requestIdRef.current += 1;
    hideModal();
    setText('');
    setMode(false);
    setOpenChapter(false);
    setError('');
    setResult([]);
    setSearching(false);
  };

  const navigateToChapter = (chap: ChapterInfo) => {
    onDismiss();
    navigation.navigate('Chapter', {
      novel: novel,
      chapter: chap,
    });
  };

  const scrollToChapter = async (chap: ChapterInfo, requestId: number) => {
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
      const targetBatch = Math.floor((chap.position ?? 0) / CHAPTER_BATCH_SIZE);
      await loadUpToBatch(targetBatch);
      if (requestId !== requestIdRef.current) {
        return;
      }

      await new Promise<void>(resolve => {
        setTimeout(() => {
          if (requestId !== requestIdRef.current) {
            resolve();
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
            resolve();
            return;
          }

          onDismiss();
          chapterListRef.current?.scrollToIndex({
            animated: true,
            index: resolvedIndex,
            viewPosition: 0.5,
          });
          resolve();
        }, 0);
      });
      return;
    }

    setError(
      getString('novelScreen.jumpToChapterModal.error.validChapterNumber'),
    );
  };

  const runChapterAction = async (chapter: ChapterInfo, requestId: number) => {
    if (openChapter) {
      navigateToChapter(chapter);
    } else {
      await scrollToChapter(chapter, requestId);
    }
  };

  const executeFunction = async (item: ChapterInfo) => {
    if (searching) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setSearching(true);
    setError('');
    try {
      await runChapterAction(item, requestId);
    } catch (actionError) {
      if (requestId === requestIdRef.current) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : String(actionError),
        );
      }
    }
    if (requestId === requestIdRef.current) {
      setSearching(false);
    }
  };

  const renderItem = ({ item }: LegendListRenderItemProps<ChapterInfo>) => {
    return (
      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: theme.rippleColor }}
        disabled={searching}
        onPress={() => void executeFunction(item)}
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
    if (searching) {
      return;
    }

    const query = text.trim();
    const requestId = ++requestIdRef.current;
    const hasKnownMax = maxNumber >= minNumber;
    setError('');
    setResult([]);
    setSearching(true);
    const performSearch = async () => {
      if (!mode) {
        const num = Number(query);
        if (
          Number.isInteger(num) &&
          num >= minNumber &&
          (!hasKnownMax || num <= maxNumber)
        ) {
          const chapters = await getNovelChaptersByNumber(novel.id, num);
          if (requestId !== requestIdRef.current) {
            return;
          }

          if (chapters.length > 0) {
            await runChapterAction(chapters[0], requestId);
            return;
          }
        }

        const range = hasKnownMax
          ? `${minNumber}–${maxNumber}`
          : `≥ ${minNumber}`;
        setError(
          `${getString(
            'novelScreen.jumpToChapterModal.error.validChapterNumber',
          )} (${range})`,
        );
        return;
      }

      if (!query) {
        setError(
          getString('novelScreen.jumpToChapterModal.error.validChapterName'),
        );
        return;
      }

      const chapters = await getNovelChaptersByName(
        novel.id,
        query.toLowerCase(),
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
        await runChapterAction(chapters[0], requestId);
        return;
      }

      setResult(chapters);
    };
    try {
      await performSearch();
    } catch (searchError) {
      if (requestId === requestIdRef.current) {
        setError(
          searchError instanceof Error
            ? searchError.message
            : String(searchError),
        );
      }
    }
    if (requestId === requestIdRef.current) {
      setSearching(false);
    }
  };

  const onChangeText = (value: string) => {
    setText(value);
    setError('');
    setResult([]);
  };

  const toggleMode = () => {
    requestIdRef.current += 1;
    setMode(current => !current);
    setText('');
    setError('');
    setResult([]);
    setSearching(false);
  };

  const hasKnownMax = maxNumber >= minNumber;
  const inputPlaceholder =
    !mode && hasKnownMax ? `${minNumber}–${maxNumber}` : undefined;
  const listExtraData = useMemo(
    () => ({ openChapter, searching }),
    [openChapter, searching],
  );

  return (
    <Dialog.Root visible={modalVisible} onDismiss={onDismiss}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('novelScreen.jumpToChapterModal.jumpToChapter')}
        </Dialog.Title>
        <Dialog.Description>
          {getString('novelScreen.jumpToChapterModal.description')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.ScrollArea>
        <LegendList
          contentContainerStyle={styles.listContentCtn}
          data={result}
          estimatedItemSize={64}
          extraData={listExtraData}
          keyboardShouldPersistTaps="handled"
          keyExtractor={item => `chapter_${item.id}`}
          ListHeaderComponent={
            <View>
              <SwitchItem
                description={getString(
                  'novelScreen.jumpToChapterModal.searchByNameDescription',
                )}
                label={getString('novelScreen.jumpToChapterModal.searchByName')}
                value={mode}
                theme={theme}
                onPress={toggleMode}
              />
              <View style={styles.inputContainer}>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={Boolean(error)}
                  label={getString(
                    mode
                      ? 'novelScreen.jumpToChapterModal.chapterName'
                      : 'novelScreen.jumpToChapterModal.chapterNumber',
                  )}
                  mode="outlined"
                  onChangeText={onChangeText}
                  onSubmitEditing={() => void onSubmit()}
                  placeholder={inputPlaceholder}
                  returnKeyType="search"
                  theme={inputTheme}
                  value={text}
                  keyboardType={mode ? 'default' : 'number-pad'}
                />
                {error ? <HelperText type="error">{error}</HelperText> : null}
              </View>
              <SwitchItem
                description={getString(
                  'novelScreen.jumpToChapterModal.openChapterDescription',
                )}
                label={getString('novelScreen.jumpToChapterModal.openChapter')}
                value={openChapter}
                theme={theme}
                onPress={() => setOpenChapter(current => !current)}
              />
              {result.length > 0 ? (
                <View
                  importantForAccessibility="no"
                  style={[
                    styles.resultDivider,
                    { backgroundColor: theme.outlineVariant },
                  ]}
                />
              ) : null}
            </View>
          }
          recycleItems
          renderItem={renderItem}
          style={styles.list}
        />
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onDismiss} title={getString('common.cancel')} />
        <Dialog.Action
          disabled={searching}
          loading={searching}
          onPress={() => void onSubmit()}
          title={getString('common.search')}
        />
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
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  list: {
    flexGrow: 0,
    flexShrink: 1,
  },
  listContentCtn: {
    paddingBottom: 8,
  },
  listElementContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resultDivider: {
    height: 1,
    width: '100%',
  },
});
