import { useState } from 'react';
import { StyleSheet, View, TextInput } from 'react-native';

import { IconButton } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { Dialog } from '@components';

interface DownloadCustomChapterModalProps {
  theme: ThemeColors;
  hideModal: () => void;
  modalVisible: boolean;
  novel: NovelInfo;
  chapters: ChapterInfo[];
  downloadChapters: (novel: NovelInfo, chapters: ChapterInfo[]) => void;
}

const DownloadCustomChapterModal = ({
  theme,
  hideModal,
  modalVisible,
  novel,
  chapters,
  downloadChapters,
}: DownloadCustomChapterModalProps) => {
  const [text, setText] = useState(0);

  const onDismiss = () => {
    hideModal();
    setText(0);
  };

  const onSubmit = () => {
    hideModal();
    downloadChapters(
      novel,
      chapters
        .filter(chapter => chapter.unread && !chapter.isDownloaded)
        .slice(0, text),
    );
  };

  const onChangeText = (txt: string) => {
    if (Number(txt) >= 0) {
      setText(Number(txt));
    }
  };

  return (
    <Dialog.Root visible={modalVisible} onDismiss={onDismiss}>
      <Dialog.Title>
        {getString('novelScreen.download.customAmount')}
      </Dialog.Title>
      <Dialog.Content>
        <View style={styles.row}>
          <IconButton
            icon="chevron-double-left"
            animated
            size={24}
            iconColor={theme.primary}
            onPress={() => {
              if (text > 9) {
                setText(prevState => prevState - 10);
              }
            }}
          />
          <IconButton
            icon="chevron-left"
            animated
            size={24}
            iconColor={theme.primary}
            onPress={() => {
              if (text > 0) {
                setText(prevState => prevState - 1);
              }
            }}
          />
          <TextInput
            value={text.toString()}
            style={[{ color: theme.onSurface }, styles.marginHorizontal]}
            keyboardType="numeric"
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
          />
          <IconButton
            icon="chevron-right"
            animated
            size={24}
            iconColor={theme.primary}
            onPress={() => setText(prevState => prevState + 1)}
          />
          <IconButton
            icon="chevron-double-right"
            animated
            size={24}
            iconColor={theme.primary}
            onPress={() => setText(prevState => prevState + 10)}
          />
        </View>
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action title={getString('common.cancel')} onPress={onDismiss} />
        <Dialog.Action
          title={getString('libraryScreen.bottomSheet.display.download')}
          onPress={onSubmit}
        />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default DownloadCustomChapterModal;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  marginHorizontal: { marginHorizontal: 4 },
});
