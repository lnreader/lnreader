import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TextInput } from 'react-native-paper';
import { openDocumentTree } from 'react-native-saf-x';

import { Dialog, List, SwitchItem } from '@components';

import { useBoolean } from '@hooks';
import { getString } from '@i18n/translations';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { showToast } from '@utils/showToast';

interface ExportEpubModalProps {
  isVisible: boolean;
  defaultFileName: string;
  onSubmit?: (
    uri: string,
    fileName: string,
    startChapter?: number,
    endChapter?: number,
  ) => Promise<void>;
  hideModal: () => void;
}

const ExportEpubModal: React.FC<ExportEpubModalProps> = ({
  isVisible,
  defaultFileName,
  onSubmit: onSubmitProp,
  hideModal,
}) => {
  const theme = useTheme();
  const {
    epubLocation = '',
    epubUseAppTheme = false,
    epubUseCustomCSS = false,
    epubUseCustomJS = false,
    setChapterReaderSettings,
  } = useChapterReaderSettings();

  const [uri, setUri] = useState(epubLocation);
  const [fileName, setFileName] = useState(defaultFileName);
  const useAppTheme = useBoolean(epubUseAppTheme);
  const useCustomCSS = useBoolean(epubUseCustomCSS);
  const useCustomJS = useBoolean(epubUseCustomJS);
  const exportAll = useBoolean(true);
  const [startChapter, setStartChapter] = useState('');
  const [endChapter, setEndChapter] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onDismiss = () => {
    hideModal();
    setUri(epubLocation);
    setFileName(defaultFileName);
    exportAll.setTrue();
    setStartChapter('');
    setEndChapter('');
  };

  const onSubmit = async () => {
    if (!exportAll.value) {
      const start = parseInt(startChapter, 10);
      const end = parseInt(endChapter, 10);

      if (isNaN(start) || isNaN(end)) {
        showToast(getString('novelScreen.exportEpubModal.invalidRange'));
        return;
      }

      if (start < 1 || end < 1) {
        showToast(getString('novelScreen.exportEpubModal.invalidRange'));
        return;
      }

      if (start > end) {
        showToast(getString('novelScreen.exportEpubModal.startGreaterThanEnd'));
        return;
      }
    }

    setChapterReaderSettings({
      epubLocation: uri,
      epubUseAppTheme: useAppTheme.value,
      epubUseCustomCSS: useCustomCSS.value,
      epubUseCustomJS: useCustomJS.value,
    });

    const start = exportAll.value ? undefined : parseInt(startChapter, 10);
    const end = exportAll.value ? undefined : parseInt(endChapter, 10);

    setSubmitting(true);
    try {
      await onSubmitProp?.(uri, fileName, start, end);
      hideModal();
    } finally {
      setSubmitting(false);
    }
  };

  const openFolderPicker = async () => {
    try {
      const resultUri = await openDocumentTree(true);
      if (resultUri) {
        setUri(resultUri.uri);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Dialog.Root visible={isVisible} onDismiss={onDismiss}>
      <Dialog.Title>
        {getString('novelScreen.exportEpubModal.title')}
      </Dialog.Title>
      <Dialog.Content>
        <TextInput
          onChangeText={setUri}
          value={uri}
          placeholder={getString('novelScreen.exportEpubModal.selectFolder')}
          onSubmitEditing={onSubmit}
          mode="outlined"
          theme={{ colors: { ...theme } }}
          underlineColor={theme.outline}
          dense
          right={
            <TextInput.Icon
              icon="folder-edit-outline"
              onPress={openFolderPicker}
            />
          }
        />
        <TextInput
          label={getString('novelScreen.exportEpubModal.fileName')}
          value={fileName}
          onChangeText={setFileName}
          onSubmitEditing={onSubmit}
          mode="outlined"
          theme={{ colors: { ...theme } }}
          underlineColor={theme.outline}
          dense
          right={<TextInput.Affix text=".epub" />}
          style={styles.fileNameInput}
        />
      </Dialog.Content>
      <Dialog.List>
        <SwitchItem
          label={getString('novelScreen.exportEpubModal.exportAll')}
          value={exportAll.value}
          onPress={exportAll.toggle}
          theme={theme}
        />
        {!exportAll.value ? (
          <View style={styles.rangeInputs}>
            <TextInput
              label={getString('novelScreen.exportEpubModal.startChapter')}
              value={startChapter}
              onChangeText={setStartChapter}
              keyboardType="numeric"
              mode="outlined"
              theme={{ colors: { ...theme } }}
              underlineColor={theme.outline}
              dense
              style={styles.rangeInput}
            />
            <TextInput
              label={getString('novelScreen.exportEpubModal.endChapter')}
              value={endChapter}
              onChangeText={setEndChapter}
              keyboardType="numeric"
              mode="outlined"
              theme={{ colors: { ...theme } }}
              underlineColor={theme.outline}
              dense
              style={styles.rangeInput}
            />
          </View>
        ) : null}
        <SwitchItem
          label={getString('novelScreen.exportEpubModal.applyReaderTheme')}
          value={useAppTheme.value}
          onPress={useAppTheme.toggle}
          theme={theme}
        />
        <SwitchItem
          label={getString('novelScreen.exportEpubModal.includeCustomCSS')}
          value={useCustomCSS.value}
          onPress={useCustomCSS.toggle}
          theme={theme}
        />
        <SwitchItem
          label={getString('novelScreen.exportEpubModal.includeCustomJS')}
          description={getString('novelScreen.exportEpubModal.customJSWarning')}
          value={useCustomJS.value}
          onPress={useCustomJS.toggle}
          theme={theme}
        />
      </Dialog.List>
      <Dialog.Content>
        <List.InfoItem
          style={styles.infoItem}
          title={getString(
            'novelScreen.exportEpubModal.downloadedChaptersOnly',
          )}
          theme={theme}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action disabled={submitting} onPress={onDismiss}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action disabled={submitting} onPress={() => void onSubmit()}>
          {getString('common.submit')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default ExportEpubModal;

const styles = StyleSheet.create({
  infoItem: {
    paddingHorizontal: 0,
  },
  fileNameInput: {
    marginTop: 12,
  },

  rangeInputs: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    paddingHorizontal: 24,
  },
  rangeInput: {
    flex: 1,
  },
});
