import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Portal } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@strings/translations';
import { Modal, SwitchItem, List, Button } from '@components';
import { useTranslation } from '@hooks/persisted';
import { updateNovelInfo } from '@database/queries/NovelQueries';
import { LANGUAGES, LanguagePickerModal } from '../../settings/TranslationSettingsScreen';

interface TranslationModalProps {
  theme: ThemeColors;
  hideModal: () => void;
  modalVisible: boolean;
  novel: NovelInfo;
  chapters: ChapterInfo[];
  setNovel: (novel: NovelInfo | undefined) => void;
}

const TranslationModal = ({
  theme,
  hideModal,
  modalVisible,
  novel,
  chapters,
  setNovel,
}: TranslationModalProps) => {
  const { translateChapters, isAnyTranslating } = useTranslation();
  const [langVisible, setLangVisible] = useState(false);

  const updateNovel = useCallback(
    (updates: Partial<NovelInfo>) => {
      if (!novel) {
        return;
      }
      const updatedNovel = { ...novel, ...updates };
      setNovel(updatedNovel);
      updateNovelInfo(updatedNovel);
    },
    [novel, setNovel],
  );

  const downloadedChapters = useMemo(
    () => chapters.filter(c => c.isDownloaded),
    [chapters],
  );

  const untranslatedCount = useMemo(
    () =>
      downloadedChapters.filter(
        c => !c.translatedContent || c.translationLang !== novel?.translationLang,
      ).length,
    [downloadedChapters, novel?.translationLang],
  );

  const onDismiss = () => {
    hideModal();
  };

  return (
    <Portal>
      <Modal visible={modalVisible} onDismiss={onDismiss}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          Translation Settings
        </Text>

        <SwitchItem
          label="Auto-translate chapters"
          value={!!novel?.autoTranslate}
          onPress={() => updateNovel({ autoTranslate: !novel?.autoTranslate })}
          theme={theme}
          style={styles.switchItem}
        />

        {novel?.autoTranslate ? (
          <View style={styles.optionsContainer}>
            <List.Item
              title="Translate to"
              description={
                LANGUAGES.find((l: { code: string; label: string }) => l.code === novel?.translationLang)?.label ||
                'Not selected'
              }
              icon="web"
              onPress={() => setLangVisible(true)}
              theme={theme}
            />
            <List.Item
              title="Translate all downloaded chapters"
              description={
                isAnyTranslating
                   ? 'Translating chapters...'
                   : `${untranslatedCount} chapters not yet translated`
              }
              onPress={() => {
                if (!isAnyTranslating && downloadedChapters.length > 0 && novel) {
                   translateChapters(downloadedChapters, novel);
                }
              }}
              disabled={isAnyTranslating || downloadedChapters.length === 0}
              theme={theme}
              icon="translate"
            />
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <Button
            onPress={onDismiss}
            textColor={theme.primary}
            style={styles.closeButton}
          >
            {getString('common.cancel')}
          </Button>
        </View>

        <LanguagePickerModal
          visible={langVisible}
          onDismiss={() => setLangVisible(false)}
          currentLanguage={novel?.translationLang || ''}
          onSelect={(lang: string) => updateNovel({ translationLang: lang })}
          languages={LANGUAGES}
        />
      </Modal>
    </Portal>
  );
};

export default TranslationModal;

const styles = StyleSheet.create({
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  switchItem: {
    paddingHorizontal: 0,
    paddingVertical: 8,
  },
  optionsContainer: {
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 24,
  },
  closeButton: {
    minWidth: 80,
  },
});
