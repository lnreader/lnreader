import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Dialog, RadioButton } from '@components';
import SwitchItem from '@components/Switch/SwitchItem';
import { useTheme } from '@hooks/persisted';
import { useNovelTranslationSettings } from '@hooks/persisted/useNovelTranslationSettings';
import { useTranslationSettings } from '@hooks/persisted/useTranslationSettings';
import { getString } from '@i18n/translations';
import { TARGET_LANGUAGES, languageLabel } from '@services/translation';
import { backgroundTasks } from '@services/backgroundTasks';
import { showToast } from '@utils/showToast';
import type { ChapterInfo, NovelInfo } from '@database/types';

interface NovelTranslationModalProps {
  novel: NovelInfo;
  chapters: ChapterInfo[];
  visible: boolean;
  hideModal: () => void;
}

/**
 * Per-novel translation preferences (spec §6.2).
 *
 * The language list carries a "follow global" entry rather than pre-selecting
 * the current global value: choosing it means the novel keeps tracking the
 * global setting as that changes, which is a different intent from picking
 * the same language explicitly.
 */
const FOLLOW_GLOBAL = '';

const NovelTranslationModal = ({
  novel,
  chapters,
  visible,
  hideModal,
}: NovelTranslationModalProps) => {
  const theme = useTheme();
  const { enabled, targetLang: globalTargetLang } = useTranslationSettings();
  const { autoTranslate, targetLang, setNovelTranslationSettings } =
    useNovelTranslationSettings(novel.id);

  const translateAll = () => {
    if (!chapters.length) {
      showToast(getString('novelTranslation.noChapters'));
      return;
    }
    backgroundTasks.enqueue({
      name: 'TRANSLATE_NOVEL',
      data: {
        novelId: novel.id,
        novelName: novel.name,
        pluginId: novel.pluginId,
        chapters: chapters.map(chapter => ({
          chapterId: chapter.id,
          chapterName: chapter.name,
          chapterPath: chapter.path,
        })),
      },
    });
    showToast(getString('novelTranslation.queued', { count: chapters.length }));
    hideModal();
  };

  const [showLanguages, setShowLanguages] = useState(false);

  const choices = [
    {
      value: FOLLOW_GLOBAL,
      label: getString('novelTranslation.followGlobal', {
        language: languageLabel(globalTargetLang),
      }),
    },
    ...TARGET_LANGUAGES,
  ];

  return (
    <Dialog.Root visible={visible} onDismiss={hideModal}>
      <Dialog.Title>{getString('novelTranslation.title')}</Dialog.Title>
      {enabled ? null : (
        <Dialog.Description>
          {getString('novelTranslation.disabledWarning')}
        </Dialog.Description>
      )}
      <Dialog.Content>
        <SwitchItem
          label={getString('novelTranslation.autoTranslate')}
          description={getString('novelTranslation.autoTranslateDesc')}
          value={autoTranslate}
          onPress={() =>
            setNovelTranslationSettings({ autoTranslate: !autoTranslate })
          }
          theme={theme}
        />
        {showLanguages ? (
          <FlatList
            data={choices}
            keyExtractor={choice => choice.value || 'global'}
            style={styles.list}
            renderItem={({ item }) => (
              <RadioButton
                label={item.label}
                status={(targetLang ?? FOLLOW_GLOBAL) === item.value}
                onPress={() => {
                  setNovelTranslationSettings({
                    // Stored as undefined rather than '' so the "follow
                    // global" state is the absence of an override.
                    targetLang: item.value || undefined,
                  });
                  setShowLanguages(false);
                }}
                theme={theme}
              />
            )}
          />
        ) : (
          <View style={styles.languageRow}>
            <RadioButton
              label={
                targetLang
                  ? languageLabel(targetLang)
                  : getString('novelTranslation.followGlobal', {
                      language: languageLabel(globalTargetLang),
                    })
              }
              status
              onPress={() => setShowLanguages(true)}
              theme={theme}
            />
          </View>
        )}
      </Dialog.Content>
      <Dialog.Actions>
        {/*
          Per-novel only. Library-wide bulk translation is deliberately not
          offered: one tap would fan out to thousands of chapters against a
          metered, user-paid API with no natural stopping point.
        */}
        <Dialog.Action onPress={translateAll} disabled={!enabled}>
          {getString('novelTranslation.translateAll')}
        </Dialog.Action>
        <Dialog.Action onPress={hideModal}>
          {getString('common.done')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default NovelTranslationModal;

const styles = StyleSheet.create({
  languageRow: {
    paddingTop: 8,
  },
  list: {
    maxHeight: 280,
  },
});
