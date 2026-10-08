import React, { useEffect, useRef, useState } from 'react';
import { Column, HorizontalDivider } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
} from '@expo/ui/jetpack-compose/modifiers';
import { getString } from '@i18n/translations';
import {
  AppText,
  Dialog,
  SwitchItem,
  TextInput,
  type ComposeListHandle,
} from '@components';

import { useTheme } from '@hooks/persisted';
import { ChapterInfo, NovelInfo } from '@database/types';
import { NovelScreenProps } from '@navigators/types';
import {
  getNovelChaptersByNumber,
  getNovelChaptersByName,
} from '@database/queries/ChapterQueries';
import { useNovelAction, useNovelValue } from '../NovelContext';
import { CHAPTER_BATCH_SIZE } from '@hooks/persisted/useNovel/store-helper/bootstrapService';

interface JumpToChapterModalProps {
  hideModal: () => void;
  modalVisible: boolean;
  navigation?: NovelScreenProps['navigation'];
  /** Opens a chapter in place of navigating to the reader. */
  onOpenChapter?: (chapter: ChapterInfo) => void;
  novel: NovelInfo;
  chapterListRef: React.RefObject<ComposeListHandle | null>;
}

const ChapterResult = ({
  item,
  disabled,
  onPress,
}: {
  item: ChapterInfo;
  disabled: boolean;
  onPress: () => void;
}) => {
  const theme = useTheme();
  return (
    <Column
      modifiers={[
        fillMaxWidth(),
        ...(disabled ? [] : [clickable(onPress)]),
        padding(16, 12, 16, 12),
      ]}
    >
      <AppText maxLines={1} color={theme.onSurface}>
        {item.name}
      </AppText>
      {item?.releaseTime ? (
        <AppText
          maxLines={1}
          variant="bodySmall"
          color={theme.onSurfaceVariant}
          modifiers={[padding(0, 2, 0, 0)]}
        >
          {item.releaseTime}
        </AppText>
      ) : null}
    </Column>
  );
};

const JumpToChapterModal = ({
  hideModal,
  modalVisible,
  navigation,
  onOpenChapter,
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
  const [searching, setSearching] = useState(false);

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
    if (onOpenChapter) {
      onOpenChapter(chap);
      return;
    }
    navigation?.navigate('Chapter', {
      novel: novel,
      chapter: chap,
    });
  };

  const scrollToChapter = async (chap: ChapterInfo, requestId: number) => {
    const loadedIndex = loadedChapters.findIndex(c => c.id === chap.id);
    if (loadedIndex >= 0) {
      onDismiss();
      chapterListRef.current?.scrollToIndex(loadedIndex, {
        animated: true,
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
          chapterListRef.current?.scrollToIndex(resolvedIndex, {
            animated: true,
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
    } finally {
      if (requestId === requestIdRef.current) {
        setSearching(false);
      }
    }
  };

  const renderItem = (item: ChapterInfo) => (
    <ChapterResult
      key={`chapter_${item.id}`}
      item={item}
      disabled={searching}
      onPress={() => void executeFunction(item)}
    />
  );

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
    try {
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
    } catch (searchError) {
      if (requestId === requestIdRef.current) {
        setError(
          searchError instanceof Error
            ? searchError.message
            : String(searchError),
        );
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setSearching(false);
      }
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
      <Dialog.ScrollArea fixed>
        <SwitchItem
          description={getString(
            'novelScreen.jumpToChapterModal.searchByNameDescription',
          )}
          label={getString('novelScreen.jumpToChapterModal.searchByName')}
          value={mode}
          onPress={toggleMode}
          theme={theme}
        />
        <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
          <TextInput
            error={error || null}
            label={getString(
              mode
                ? 'novelScreen.jumpToChapterModal.chapterName'
                : 'novelScreen.jumpToChapterModal.chapterNumber',
            )}
            outlined
            onChangeText={onChangeText}
            onSubmit={() => void onSubmit()}
            placeholder={inputPlaceholder}
            imeAction="search"
            value={text}
            keyboardType={mode ? 'text' : 'number'}
          />
        </Column>
        <SwitchItem
          description={getString(
            'novelScreen.jumpToChapterModal.openChapterDescription',
          )}
          label={getString('novelScreen.jumpToChapterModal.openChapter')}
          value={openChapter}
          onPress={() => setOpenChapter(current => !current)}
          theme={theme}
        />
        {result.length > 0 ? (
          <HorizontalDivider color={theme.outlineVariant} />
        ) : null}
        {result.map(renderItem)}
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
