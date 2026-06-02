import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Portal } from 'react-native-paper';
import { ThemeColors } from '@theme/types';
import { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@strings/translations';
import { Modal, SwitchItem, List, Button } from '@components';
import { useTranslation } from '@hooks/persisted';
import { useNovelStore } from '../NovelContext';
import { LANGUAGES, LanguagePickerModal } from '../../settings/components/LanguagePickerModal';

interface TranslationModalProps {
  theme: ThemeColors;
  hideModal: () => void;
  modalVisible: boolean;
  novel: NovelInfo;
  chapters: ChapterInfo[];
}

const TranslationModal = ({
  theme,
  hideModal,
  modalVisible,
  novel,
  chapters,
}: TranslationModalProps) => {
  const { translateChapters, isAnyTranslating, clearAllTranslations } = useTranslation();
  const [langVisible, setLangVisible] = useState(false);

  const novelSettings = useNovelStore(state => state.novelSettings);
  const setNovelSettings = useNovelStore(state => state.actions.setNovelSettings);

  const downloadedChapters = useMemo(
    () => chapters.filter(c => c.isDownloaded),
    [chapters],
  );

  const untranslatedChapters = useMemo(
    () =>
      downloadedChapters.filter(
        c => !c.translationLang || c.translationLang !== novelSettings.translationLang,
      ),
    [downloadedChapters, novelSettings.translationLang],
  );

  const translatedChapters = useMemo(
    () => chapters.filter(c => !!c.translationLang),
    [chapters],
  );

  const onDismiss = () => {
    hideModal();
  };

  return (
    <Portal>
      <Modal visible={modalVisible} onDismiss={onDismiss}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {getString('novelScreen.translationModal.title')}
        </Text>

        <SwitchItem
          label={getString('novelScreen.translationModal.autoTranslate')}
          value={!!novelSettings.autoTranslate}
          onPress={() => setNovelSettings({ ...novelSettings, autoTranslate: !novelSettings.autoTranslate })}
          theme={theme}
          style={styles.switchItem}
        />

        {novelSettings.autoTranslate ? (
          <View style={styles.optionsContainer}>
            <List.Item
              title={getString('novelScreen.translationModal.translateTo')}
              description={
                LANGUAGES.find((l: { code: string; label: string }) => l.code === novelSettings.translationLang)?.label ||
                getString('novelScreen.translationModal.notSelected')
              }
              icon="web"
              onPress={() => setLangVisible(true)}
              theme={theme}
            />
            <List.Item
              title={getString('novelScreen.translationModal.translateAll')}
              description={
                isAnyTranslating
                  ? getString('novelScreen.translationModal.translating')
                  : getString('novelScreen.translationModal.chaptersNotTranslated', { count: untranslatedChapters.length })
              }
              onPress={() => {
                if (!isAnyTranslating && untranslatedChapters.length > 0 && novel) {
                   translateChapters(untranslatedChapters, novel, novelSettings.translationLang);
                }
              }}
              disabled={isAnyTranslating || untranslatedChapters.length === 0}
              theme={theme}
              icon="translate"
            />
            <List.Item
              title={getString('novelScreen.translationModal.clearAll')}
              description={
                isAnyTranslating
                  ? getString('novelScreen.translationModal.clearing')
                  : getString('novelScreen.translationModal.translatedChapters', { count: translatedChapters.length })
              }
              onPress={() => {
                if (!isAnyTranslating && translatedChapters.length > 0) {
                  clearAllTranslations(translatedChapters);
                }
              }}
              disabled={isAnyTranslating || translatedChapters.length === 0}
              theme={theme}
              icon="delete-sweep"
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
          currentLanguage={novelSettings.translationLang || ''}
          onSelect={(lang: string) => setNovelSettings({ ...novelSettings, translationLang: lang })}
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
