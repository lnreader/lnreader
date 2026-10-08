import { useState } from 'react';
import { Row } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, weight } from '@expo/ui/jetpack-compose/modifiers';

import { ThemeColors } from '@theme/types';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@i18n/translations';
import { Dialog, IconButtonV2, TextInput } from '@components';
import ChevronLeftIcon from '@expo/material-symbols/chevron_left.xml';
import ChevronRightIcon from '@expo/material-symbols/chevron_right.xml';
import KeyboardDoubleArrowLeftIcon from '@expo/material-symbols/keyboard_double_arrow_left.xml';
import KeyboardDoubleArrowRightIcon from '@expo/material-symbols/keyboard_double_arrow_right.xml';

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
        <Row
          verticalAlignment="center"
          horizontalArrangement="center"
          modifiers={[fillMaxWidth()]}
        >
          <IconButtonV2
            name={KeyboardDoubleArrowLeftIcon}
            color={theme.primary}
            onPress={() => {
              if (text > 9) {
                setText(prevState => prevState - 10);
              }
            }}
            theme={theme}
          />
          <IconButtonV2
            name={ChevronLeftIcon}
            color={theme.primary}
            onPress={() => {
              if (text > 0) {
                setText(prevState => prevState - 1);
              }
            }}
            theme={theme}
          />
          <TextInput
            value={text.toString()}
            keyboardType="number"
            onChangeText={onChangeText}
            onSubmit={onSubmit}
            modifiers={[weight(1)]}
          />
          <IconButtonV2
            name={ChevronRightIcon}
            color={theme.primary}
            onPress={() => setText(prevState => prevState + 1)}
            theme={theme}
          />
          <IconButtonV2
            name={KeyboardDoubleArrowRightIcon}
            color={theme.primary}
            onPress={() => setText(prevState => prevState + 10)}
            theme={theme}
          />
        </Row>
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
