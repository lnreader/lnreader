import React, { useState } from 'react';
import { Box, Column, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';

import {
  AppText,
  Dialog,
  IconButtonV2,
  SwitchItem,
  TextInput,
} from '@components';
import FolderIcon from '@expo/material-symbols/folder.xml';
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
        <Column
          verticalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}
        >
          <Box
            modifiers={[
              fillMaxWidth(),
              clickable(() => void openFolderPicker()),
            ]}
          >
            <TextInput
              disabled
              label={getString('novelScreen.exportEpubModal.directory')}
              placeholder={getString(
                'novelScreen.exportEpubModal.selectFolder',
              )}
              trailing={
                <IconButtonV2
                  accessibilityLabel={getString(
                    'novelScreen.exportEpubModal.selectFolder',
                  )}
                  name={FolderIcon}
                  onPress={() => void openFolderPicker()}
                  theme={theme}
                />
              }
              value={uri}
              onChangeText={() => undefined}
            />
          </Box>
          <TextInput
            error={
              fileNameError
                ? getString('novelScreen.exportEpubModal.fileNameRequired')
                : null
            }
            label={getString('novelScreen.exportEpubModal.fileName')}
            onChangeText={value => {
              setFileName(value);
              if (value.trim()) {
                setFileNameError(false);
              }
            }}
            onSubmit={() => void onSubmit()}
            singleLine
            trailing={<AppText variant="bodyLarge">.epub</AppText>}
            value={fileName}
          />
        </Column>
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
          label={getString('novelScreen.exportEpubModal.includeChapterNumber')}
          value={includeChapterNumber.value}
          onPress={includeChapterNumber.toggle}
          theme={theme}
        />
        {!exportAll.value ? (
          <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 8)]}>
            <Row horizontalArrangement={{ spacedBy: 12 }}>
              <TextInput
                label={getString('novelScreen.exportEpubModal.startChapter')}
                value={startChapter}
                onChangeText={value => {
                  setStartChapter(value);
                  setRangeError('');
                }}
                keyboardType="number"
                singleLine
                modifiers={[weight(1)]}
              />
              <TextInput
                label={getString('novelScreen.exportEpubModal.endChapter')}
                value={endChapter}
                onChangeText={value => {
                  setEndChapter(value);
                  setRangeError('');
                }}
                keyboardType="number"
                onSubmit={() => void onSubmit()}
                singleLine
                modifiers={[weight(1)]}
              />
            </Row>
            {rangeError ? (
              <AppText variant="bodySmall" color={theme.error}>
                {rangeError}
              </AppText>
            ) : null}
          </Column>
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
