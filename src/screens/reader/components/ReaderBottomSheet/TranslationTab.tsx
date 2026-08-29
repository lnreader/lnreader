import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Chip } from 'react-native-paper';
import {
  Button,
  List,
  OptionPickerDialog,
  RegexRulesEditor,
  type TranslationOption,
} from '@components';
import { useTheme, useTranslationSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import type { StringMap } from '@i18n/types';
import { computeEffectiveTranslationSettings } from '@api/translation/settings';
import { BUILT_IN_PROMPTS } from '@api/translation/prompts';
import {
  getLanguageName,
  TRANSLATION_LANGUAGES,
} from '@api/translation/languages';
import {
  TRANSLATION_PARALLEL_MODES,
  TRANSLATION_PROVIDERS,
  type TranslationProvider,
} from '@api/translation/types';
import ReaderSheetPreferenceItem from './ReaderSheetPreferenceItem';
import { useChapterContext } from '../../ChapterContext';

interface TranslationTabProps {
  onRedoTranslation: () => void;
}

const providerLabel = (provider: string): string =>
  getString(
    `translationSettings.providers.${provider.toLowerCase()}` as keyof StringMap,
  );

const parallelModeLabel = (mode: string): string =>
  getString(`translationSettings.parallelModes.${mode}` as keyof StringMap);

const promptName = (
  promptId: string | undefined | null,
  customPrompts: { id: string; name: string }[],
  fallback: string,
): string => {
  if (promptId === null) return getString('translationSettings.promptNone');
  if (promptId === undefined) return fallback;
  const builtIn = BUILT_IN_PROMPTS[promptId as keyof typeof BUILT_IN_PROMPTS];
  if (builtIn) return builtIn.name;
  return customPrompts.find(p => p.id === promptId)?.name ?? fallback;
};

const TranslationTab: React.FC<TranslationTabProps> = ({
  onRedoTranslation,
}) => {
  const theme = useTheme();
  const { novel } = useChapterContext();
  const settings = useTranslationSettings();
  const effective = useMemo(
    () => computeEffectiveTranslationSettings(settings, novel.id),
    [novel.id, settings],
  );

  const [providerModal, setProviderModal] = React.useState(false);
  const [sourceModal, setSourceModal] = React.useState(false);
  const [targetModal, setTargetModal] = React.useState(false);
  const [promptModal, setPromptModal] = React.useState(false);

  const providerOptions: TranslationOption[] = useMemo(
    () =>
      TRANSLATION_PROVIDERS.map(provider => ({
        key: provider,
        label: providerLabel(provider),
      })),
    [],
  );

  const languageOptions: TranslationOption[] = useMemo(
    () =>
      TRANSLATION_LANGUAGES.map(language => ({
        key: language.code,
        label: language.name,
      })),
    [],
  );

  const promptOptions: TranslationOption[] = useMemo(() => {
    const globalName = promptName(
      settings.defaultPromptId,
      settings.prompts,
      getString('translationSettings.promptNone'),
    );
    const options: TranslationOption[] = [
      {
        key: '__global__',
        label: `${getString(
          'translationSettings.promptGlobalDefault',
        )} (${globalName})`,
      },
      { key: '__none__', label: getString('translationSettings.promptNone') },
    ];
    Object.entries(BUILT_IN_PROMPTS).forEach(([id, prompt]) =>
      options.push({ key: id, label: prompt.name }),
    );
    settings.prompts.forEach(prompt =>
      options.push({ key: prompt.id, label: prompt.name }),
    );
    return options;
  }, [settings.defaultPromptId, settings.prompts]);

  const currentPromptKey =
    effective.promptId === null
      ? '__none__'
      : effective.promptId === undefined
      ? '__global__'
      : effective.promptId;

  const setPerNovel = (
    values: Parameters<typeof settings.setPerNovelTranslationSettings>[1],
  ) => settings.setPerNovelTranslationSettings(novel.id, values);

  return (
    <>
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <List.SubHeader theme={theme}>
          {getString('readerScreen.bottomSheet.translation')}
        </List.SubHeader>

        <ReaderSheetPreferenceItem
          description={getString(
            'readerScreen.bottomSheet.translationEnableDescription',
          )}
          label={getString('translationSettings.enable')}
          value={effective.enabled}
          onPress={() =>
            settings.setTranslationSettings({ enabled: !settings.enabled })
          }
          theme={theme}
        />

        {effective.enabled ? (
          <>
            <List.SubHeader theme={theme}>
              {getString('translationSettings.parallelMode')}
            </List.SubHeader>
            <View style={styles.chips}>
              {TRANSLATION_PARALLEL_MODES.map(mode => {
                const selected = effective.parallelMode === mode;
                return (
                  <Chip
                    key={mode}
                    selected={selected}
                    onPress={() => setPerNovel({ parallelMode: mode })}
                    style={[
                      styles.chip,
                      selected && { backgroundColor: theme.primary },
                    ]}
                    textStyle={{
                      color: selected ? theme.onPrimary : theme.onSurface,
                    }}
                  >
                    {parallelModeLabel(mode)}
                  </Chip>
                );
              })}
            </View>

            <List.SubHeader theme={theme}>
              {getString('readerScreen.bottomSheet.translationSettings')}
            </List.SubHeader>
            <List.Item
              title={getString('translationSettings.provider')}
              description={providerLabel(effective.provider)}
              onPress={() => setProviderModal(true)}
              right="chevron-right"
              theme={theme}
            />
            <List.Item
              title={getString('translationSettings.sourceLanguage')}
              description={getLanguageName(effective.sourceLanguage)}
              onPress={() => setSourceModal(true)}
              right="chevron-right"
              theme={theme}
            />
            <List.Item
              title={getString('translationSettings.targetLanguage')}
              description={getLanguageName(effective.targetLanguage)}
              onPress={() => setTargetModal(true)}
              right="chevron-right"
              theme={theme}
            />
            <List.Item
              title={getString('translationSettings.prompt')}
              description={promptName(
                effective.promptId,
                settings.prompts,
                promptName(
                  settings.defaultPromptId,
                  settings.prompts,
                  getString('translationSettings.promptNone'),
                ),
              )}
              onPress={() => setPromptModal(true)}
              right="chevron-right"
              theme={theme}
            />

            <Button
              mode="outlined"
              title={getString('readerScreen.bottomSheet.translationRedo')}
              onPress={onRedoTranslation}
              style={styles.redoButton}
            />

            <List.SubHeader theme={theme}>
              {getString('readerScreen.bottomSheet.translationRegex')}
            </List.SubHeader>
            <RegexRulesEditor
              rules={effective.regexRules}
              onChange={regexRules => setPerNovel({ regexRules })}
            />
          </>
        ) : (
          <List.InfoItem
            title={getString(
              'readerScreen.bottomSheet.translationDisabledNotice',
            )}
            theme={theme}
          />
        )}
      </BottomSheetScrollView>

      <OptionPickerDialog
        visible={providerModal}
        onDismiss={() => setProviderModal(false)}
        title={getString('translationSettings.provider')}
        options={providerOptions}
        current={effective.provider}
        onSelect={provider =>
          settings.setTranslationSettings({
            provider: provider as TranslationProvider,
          })
        }
      />
      <OptionPickerDialog
        visible={sourceModal}
        onDismiss={() => setSourceModal(false)}
        title={getString('translationSettings.sourceLanguage')}
        options={languageOptions}
        current={effective.sourceLanguage}
        onSelect={sourceLanguage => setPerNovel({ sourceLanguage })}
      />
      <OptionPickerDialog
        visible={targetModal}
        onDismiss={() => setTargetModal(false)}
        title={getString('translationSettings.targetLanguage')}
        options={languageOptions}
        current={effective.targetLanguage}
        onSelect={targetLanguage => setPerNovel({ targetLanguage })}
      />
      <OptionPickerDialog
        visible={promptModal}
        onDismiss={() => setPromptModal(false)}
        title={getString('translationSettings.prompt')}
        options={promptOptions}
        current={currentPromptKey}
        onSelect={key => {
          if (key === '__global__') setPerNovel({ promptId: undefined });
          else if (key === '__none__') setPerNovel({ promptId: null });
          else setPerNovel({ promptId: key });
        }}
      />
    </>
  );
};

export default React.memo(TranslationTab);

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chip: {
    marginEnd: 8,
    marginBottom: 8,
  },
  redoButton: {
    marginHorizontal: 16,
    marginTop: 12,
  },
});
