import { useMemo } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  Appbar,
  LanguagePickerDialog,
  List,
  OptionPickerDialog,
  PromptsManager,
  ProviderSettingsPanel,
  RegexRulesEditor,
  SafeAreaView,
  SwitchItem,
  type TranslationOption,
} from '@components';
import { useTheme, useTranslationSettings } from '@hooks/persisted';
import { useBoolean } from '@hooks';
import { getString } from '@i18n/translations';
import type { StringMap } from '@i18n/types';
import { BUILT_IN_PROMPTS } from '@api/translation/prompts';
import { getLanguageName } from '@api/translation/languages';
import {
  TRANSLATION_PARALLEL_MODES,
  type TranslationParallelMode,
} from '@api/translation/types';
import type { TranslationSettingsScreenProps } from '@navigators/types';

const parallelModeLabel = (mode: string): string =>
  getString(`translationSettings.parallelModes.${mode}` as keyof StringMap);

const promptName = (
  promptId: string | undefined | null,
  customPrompts: { id: string; name: string }[],
): string =>
  promptId == null
    ? getString('translationSettings.promptNone')
    : BUILT_IN_PROMPTS[promptId as keyof typeof BUILT_IN_PROMPTS]?.name ??
      customPrompts.find(p => p.id === promptId)?.name ??
      getString('translationSettings.promptNone');

const TranslationSettingsScreen = ({
  navigation,
}: TranslationSettingsScreenProps) => {
  const theme = useTheme();
  const settings = useTranslationSettings();

  const sourceModal = useBoolean(false);
  const targetModal = useBoolean(false);
  const parallelModal = useBoolean(false);
  const promptModal = useBoolean(false);

  const parallelOptions: TranslationOption[] = useMemo(
    () =>
      TRANSLATION_PARALLEL_MODES.map(mode => ({
        key: mode,
        label: parallelModeLabel(mode),
      })),
    [],
  );

  const promptOptions: TranslationOption[] = useMemo(() => {
    const options: TranslationOption[] = [
      { key: '__none__', label: getString('translationSettings.promptNone') },
    ];
    Object.entries(BUILT_IN_PROMPTS).forEach(([id, prompt]) =>
      options.push({ key: id, label: prompt.name }),
    );
    settings.prompts.forEach(prompt =>
      options.push({ key: prompt.id, label: prompt.name }),
    );
    return options;
  }, [settings.prompts]);

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('translationSettings.title')}
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('translationSettings.general')}
          </List.SubHeader>
          <SwitchItem
            theme={theme}
            value={settings.enabled}
            label={getString('translationSettings.enable')}
            description={getString('translationSettings.enableDescription')}
            onPress={() =>
              settings.setTranslationSettings({ enabled: !settings.enabled })
            }
          />
          <List.Item
            title={getString('translationSettings.parallelMode')}
            description={parallelModeLabel(settings.parallelMode)}
            onPress={parallelModal.setTrue}
            right="chevron-right"
            theme={theme}
          />
          <List.Item
            title={getString('translationSettings.sourceLanguage')}
            description={getLanguageName(settings.sourceLanguage)}
            onPress={sourceModal.setTrue}
            right="chevron-right"
            theme={theme}
          />
          <List.Item
            title={getString('translationSettings.targetLanguage')}
            description={getLanguageName(settings.targetLanguage)}
            onPress={targetModal.setTrue}
            right="chevron-right"
            theme={theme}
          />
          <List.Item
            title={getString('translationSettings.defaultPrompt')}
            description={promptName(settings.defaultPromptId, settings.prompts)}
            onPress={promptModal.setTrue}
            right="chevron-right"
            theme={theme}
          />
        </List.Section>

        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('translationSettings.translationServices')}
          </List.SubHeader>
          <ProviderSettingsPanel
            provider={settings.provider}
            settings={settings}
            setTranslationSettings={settings.setTranslationSettings}
          />
        </List.Section>

        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('translationSettings.customPrompts')}
          </List.SubHeader>
          <PromptsManager
            prompts={settings.prompts}
            onChange={prompts => settings.setTranslationSettings({ prompts })}
          />
        </List.Section>

        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('translationSettings.regexRules')}
          </List.SubHeader>
          <RegexRulesEditor
            rules={settings.regexRules}
            onChange={regexRules =>
              settings.setTranslationSettings({ regexRules })
            }
          />
        </List.Section>
      </ScrollView>

      <LanguagePickerDialog
        visible={sourceModal.value}
        onDismiss={sourceModal.setFalse}
        title={getString('translationSettings.sourceLanguage')}
        current={settings.sourceLanguage}
        onSelect={sourceLanguage =>
          settings.setTranslationSettings({ sourceLanguage })
        }
      />
      <LanguagePickerDialog
        visible={targetModal.value}
        onDismiss={targetModal.setFalse}
        title={getString('translationSettings.targetLanguage')}
        current={settings.targetLanguage}
        onSelect={targetLanguage =>
          settings.setTranslationSettings({ targetLanguage })
        }
      />
      <OptionPickerDialog
        visible={parallelModal.value}
        onDismiss={parallelModal.setFalse}
        title={getString('translationSettings.parallelMode')}
        options={parallelOptions}
        current={settings.parallelMode}
        onSelect={parallelMode =>
          settings.setTranslationSettings({
            parallelMode: parallelMode as TranslationParallelMode,
          })
        }
      />
      <OptionPickerDialog
        visible={promptModal.value}
        onDismiss={promptModal.setFalse}
        title={getString('translationSettings.defaultPrompt')}
        options={promptOptions}
        current={settings.defaultPromptId || '__none__'}
        onSelect={key =>
          settings.setTranslationSettings({
            defaultPromptId: key === '__none__' ? '' : key,
          })
        }
      />
    </SafeAreaView>
  );
};

export default TranslationSettingsScreen;

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
});
