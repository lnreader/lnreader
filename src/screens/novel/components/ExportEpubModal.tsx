import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import { Dialog, SwitchItem } from '@components';
import NativeFile from '@modules/native-file';

import { useBoolean } from '@hooks';
import { getString } from '@i18n/translations';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { showToast } from '@utils/showToast';

interface ExportEpubModalProps {
  isVisible: boolean;
  defaultFileName: string;
  onSubmit: (
    uri: string,
    fileName: string,
    options: EpubExportOptions,
    startChapter?: number,
    endChapter?: number,
  ) => Promise<void>;
  hideModal: () => void;
}

export interface EpubExportOptions {
  useAppTheme: boolean;
  useCustomCSS: boolean;
  useCustomJS: boolean;
  includeChapterNumber: boolean;
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
    epubIncludeChapterNumber = false,
    setChapterReaderSettings,
  } = useChapterReaderSettings();

  const [uri, setUri] = useState(epubLocation);
  const [fileName, setFileName] = useState(defaultFileName);
  const useAppTheme = useBoolean(epubUseAppTheme);
  const useCustomCSS = useBoolean(epubUseCustomCSS);
  const useCustomJS = useBoolean(epubUseCustomJS);
  const includeChapterNumber = useBoolean(epubIncludeChapterNumber);
  const exportAll = useBoolean(true);
  const [startChapter, setStartChapter] = useState('');
  const [endChapter, setEndChapter] = useState('');
  const [fileNameError, setFileNameError] = useState(false);
  const [rangeError, setRangeError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onDismiss = () => {
    if (submitting) {
      return;
    }

    hideModal();
    setUri(epubLocation);
    setFileName(defaultFileName);
    setFileNameError(false);
    setRangeError('');
    exportAll.setTrue();
    setStartChapter('');
    setEndChapter('');
  };

  const onSubmit = async () => {
    const trimmedFileName = fileName.trim();
    if (!trimmedFileName) {
      setFileNameError(true);
      return;
    }

    let start: number | undefined;
    let end: number | undefined;

    if (!exportAll.value) {
      start = Number(startChapter);
      end = Number(endChapter);

      if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 1 ||
        end < 1
      ) {
        setRangeError(getString('novelScreen.exportEpubModal.invalidRange'));
        return;
      }

      if (start > end) {
        setRangeError(
          getString('novelScreen.exportEpubModal.startGreaterThanEnd'),
        );
        return;
      }
    }

    setFileNameError(false);
    setRangeError('');
    setChapterReaderSettings({
      epubLocation: uri,
      epubUseAppTheme: useAppTheme.value,
      epubUseCustomCSS: useCustomCSS.value,
      epubUseCustomJS: useCustomJS.value,
      epubIncludeChapterNumber: includeChapterNumber.value,
    });

    setSubmitting(true);
    try {
      await onSubmitProp(
        uri,
        trimmedFileName,
        {
          useAppTheme: useAppTheme.value,
          useCustomCSS: useCustomCSS.value,
          useCustomJS: useCustomJS.value,
          includeChapterNumber: includeChapterNumber.value,
        },
        start,
        end,
      );
      hideModal();
    } finally {
      setSubmitting(false);
    }
  };

  const openFolderPicker = async () => {
    try {
      const result = await NativeFile.pickDirectory();
      setUri(result.uri);
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <Dialog.Root visible={isVisible} onDismiss={onDismiss}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('novelScreen.exportEpubModal.title')}
        </Dialog.Title>
        <Dialog.Description>
          {getString('novelScreen.exportEpubModal.description')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.ScrollArea>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <Pressable
              accessibilityHint={uri || undefined}
              accessibilityLabel={getString(
                'novelScreen.exportEpubModal.selectFolder',
              )}
              accessibilityRole="button"
              onPress={() => void openFolderPicker()}
            >
              <TextInput
                editable={false}
                label={getString('novelScreen.exportEpubModal.directory')}
                mode="outlined"
                pointerEvents="none"
                placeholder={getString(
                  'novelScreen.exportEpubModal.selectFolder',
                )}
                right={
                  <TextInput.Icon
                    accessibilityLabel={getString(
                      'novelScreen.exportEpubModal.selectFolder',
                    )}
                    forceTextInputFocus={false}
                    icon="folder-outline"
                    onPress={() => void openFolderPicker()}
                  />
                }
                theme={{ colors: { ...theme } }}
                value={uri}
              />
            </Pressable>
            <View>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                error={fileNameError}
                label={getString('novelScreen.exportEpubModal.fileName')}
                mode="outlined"
                onChangeText={value => {
                  setFileName(value);
                  if (value.trim()) {
                    setFileNameError(false);
                  }
                }}
                onSubmitEditing={() => void onSubmit()}
                returnKeyType="done"
                right={<TextInput.Affix text=".epub" />}
                theme={{ colors: { ...theme } }}
                value={fileName}
              />
              {fileNameError ? (
                <HelperText type="error">
                  {getString('novelScreen.exportEpubModal.fileNameRequired')}
                </HelperText>
              ) : null}
            </View>
          </View>
          <SwitchItem
            label={getString('novelScreen.exportEpubModal.exportAll')}
            value={exportAll.value}
            onPress={() => {
              exportAll.toggle();
              setRangeError('');
            }}
            theme={theme}
          />
          <SwitchItem
            label={getString(
              'novelScreen.exportEpubModal.includeChapterNumber',
            )}
            value={includeChapterNumber.value}
            onPress={includeChapterNumber.toggle}
            theme={theme}
          />
          {!exportAll.value ? (
            <>
              <View style={styles.rangeInputs}>
                <TextInput
                  error={Boolean(rangeError)}
                  label={getString('novelScreen.exportEpubModal.startChapter')}
                  value={startChapter}
                  onChangeText={value => {
                    setStartChapter(value);
                    setRangeError('');
                  }}
                  keyboardType="number-pad"
                  mode="outlined"
                  returnKeyType="next"
                  theme={{ colors: { ...theme } }}
                  style={styles.rangeInput}
                />
                <TextInput
                  error={Boolean(rangeError)}
                  label={getString('novelScreen.exportEpubModal.endChapter')}
                  value={endChapter}
                  onChangeText={value => {
                    setEndChapter(value);
                    setRangeError('');
                  }}
                  keyboardType="number-pad"
                  mode="outlined"
                  onSubmitEditing={() => void onSubmit()}
                  returnKeyType="done"
                  theme={{ colors: { ...theme } }}
                  style={styles.rangeInput}
                />
              </View>
              <HelperText
                style={styles.rangeError}
                type="error"
                visible={Boolean(rangeError)}
              >
                {rangeError}
              </HelperText>
            </>
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
            description={getString(
              'novelScreen.exportEpubModal.customJSWarning',
            )}
            value={useCustomJS.value}
            onPress={useCustomJS.toggle}
            theme={theme}
          />
        </ScrollView>
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action
          disabled={submitting}
          onPress={onDismiss}
          title={getString('common.cancel')}
        />
        <Dialog.Action
          disabled={submitting}
          loading={submitting}
          onPress={() => void onSubmit()}
          title={getString('novelScreen.exportEpubModal.export')}
        />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default ExportEpubModal;

const styles = StyleSheet.create({
  form: {
    gap: 12,
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  rangeInputs: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
  },
  rangeError: {
    paddingHorizontal: 16,
  },
  rangeInput: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 8,
  },
});
