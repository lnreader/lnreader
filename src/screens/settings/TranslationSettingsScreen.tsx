import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import {
  Appbar,
  Dialog,
  List,
  OptionPickerDialog,
  PromptsManager,
  RegexRulesEditor,
  SafeAreaView,
  SwitchItem,
  TextInput,
  type TranslationOption,
} from '@components';
import { useTheme, useTranslationSettings } from '@hooks/persisted';
import { useBoolean } from '@hooks';
import { getString } from '@i18n/translations';
import type { StringMap } from '@i18n/types';
import { BUILT_IN_PROMPTS } from '@api/translation/prompts';
import {
  getLanguageName,
  TRANSLATION_LANGUAGES,
} from '@api/translation/languages';
import {
  TRANSLATION_PARALLEL_MODES,
  TRANSLATION_PROVIDERS,
  type TranslationParallelMode,
  type TranslationProvider,
} from '@api/translation/types';
import type { TranslationSettingsScreenProps } from '@navigators/types';

const providerLabel = (provider: string): string =>
  getString(
    `translationSettings.providers.${provider.toLowerCase()}` as keyof StringMap,
  );

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

interface CredentialItemProps {
  label: string;
  value: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  onSave: (value: string) => void;
}

const CredentialItem: React.FC<CredentialItemProps> = ({
  label,
  value,
  placeholder,
  autoCapitalize = 'none',
  onSave,
}) => {
  const theme = useTheme();
  const modal = useBoolean(false);
  const [draft, setDraft] = useState(value);

  const open = () => {
    setDraft(value);
    modal.setTrue();
  };

  const save = () => {
    onSave(draft.trim());
    modal.setFalse();
  };

  return (
    <>
      <List.Item
        title={label}
        description={value || getString('translationSettings.noKeySet')}
        onPress={open}
        right="pencil-outline"
        theme={theme}
      />
      <Dialog.Root visible={modal.value} onDismiss={modal.setFalse}>
        <Dialog.Header>
          <Dialog.Title>{label}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Content>
          <TextInput
            placeholder={placeholder}
            defaultValue={draft}
            onChangeText={setDraft}
            autoCapitalize={autoCapitalize}
            autoCorrect={false}
            style={styles.field}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Dialog.Action onPress={modal.setFalse}>
            {getString('common.cancel')}
          </Dialog.Action>
          <Dialog.Action onPress={save}>
            {getString('common.save')}
          </Dialog.Action>
        </Dialog.Actions>
      </Dialog.Root>
    </>
  );
};

const TranslationSettingsScreen = ({
  navigation,
}: TranslationSettingsScreenProps) => {
  const theme = useTheme();
  const settings = useTranslationSettings();

  const providerModal = useBoolean(false);
  const sourceModal = useBoolean(false);
  const targetModal = useBoolean(false);
  const parallelModal = useBoolean(false);
  const promptModal = useBoolean(false);

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
            title={getString('translationSettings.mainProvider')}
            description={providerLabel(settings.provider)}
            onPress={providerModal.setTrue}
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
            {getString('translationSettings.providerCredentials')}
          </List.SubHeader>
          {settings.provider === 'GOOGLE_FREE' ? (
            <List.InfoItem
              title={getString('translationSettings.googleFreeNote')}
              theme={theme}
            />
          ) : null}
          {settings.provider === 'GOOGLE_PA' ? (
            <>
              <SwitchItem
                theme={theme}
                value={settings.useCommunityGooglePaKey}
                label={getString('translationSettings.useCommunityGooglePaKey')}
                description={getString(
                  'translationSettings.useCommunityGooglePaKeyDescription',
                )}
                onPress={() =>
                  settings.setTranslationSettings({
                    useCommunityGooglePaKey: !settings.useCommunityGooglePaKey,
                  })
                }
              />
              {settings.useCommunityGooglePaKey ? null : (
                <CredentialItem
                  label={getString('translationSettings.apiKey')}
                  value={settings.googlePaApiKey}
                  placeholder={getString(
                    'translationSettings.apiKeyPlaceholder',
                  )}
                  onSave={googlePaApiKey =>
                    settings.setTranslationSettings({ googlePaApiKey })
                  }
                />
              )}
            </>
          ) : null}
          {settings.provider === 'GEMINI' ? (
            <>
              <CredentialItem
                label={getString('translationSettings.apiKey')}
                value={settings.geminiApiKey}
                placeholder={getString('translationSettings.apiKeyPlaceholder')}
                onSave={geminiApiKey =>
                  settings.setTranslationSettings({ geminiApiKey })
                }
              />
              <CredentialItem
                label={getString('translationSettings.geminiModel')}
                value={settings.geminiModel}
                placeholder="gemini-2.0-flash"
                autoCapitalize="none"
                onSave={geminiModel =>
                  settings.setTranslationSettings({ geminiModel })
                }
              />
            </>
          ) : null}
          {settings.provider === 'OPENAI' ? (
            <>
              <CredentialItem
                label={getString('translationSettings.apiKey')}
                value={settings.openaiApiKey}
                placeholder={getString('translationSettings.apiKeyPlaceholder')}
                onSave={openaiApiKey =>
                  settings.setTranslationSettings({ openaiApiKey })
                }
              />
              <CredentialItem
                label={getString('translationSettings.openaiEndpoint')}
                value={settings.openaiEndpoint}
                placeholder="https://api.openai.com/v1"
                autoCapitalize="none"
                onSave={openaiEndpoint =>
                  settings.setTranslationSettings({ openaiEndpoint })
                }
              />
              <CredentialItem
                label={getString('translationSettings.openaiModel')}
                value={settings.openaiModel}
                placeholder="gpt-4o-mini"
                autoCapitalize="none"
                onSave={openaiModel =>
                  settings.setTranslationSettings({ openaiModel })
                }
              />
            </>
          ) : null}
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

      <OptionPickerDialog
        visible={providerModal.value}
        onDismiss={providerModal.setFalse}
        title={getString('translationSettings.mainProvider')}
        options={providerOptions}
        current={settings.provider}
        onSelect={provider =>
          settings.setTranslationSettings({
            provider: provider as TranslationProvider,
          })
        }
      />
      <OptionPickerDialog
        visible={sourceModal.value}
        onDismiss={sourceModal.setFalse}
        title={getString('translationSettings.sourceLanguage')}
        options={languageOptions}
        current={settings.sourceLanguage}
        onSelect={sourceLanguage =>
          settings.setTranslationSettings({ sourceLanguage })
        }
      />
      <OptionPickerDialog
        visible={targetModal.value}
        onDismiss={targetModal.setFalse}
        title={getString('translationSettings.targetLanguage')}
        options={languageOptions}
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
  field: {
    marginTop: 12,
  },
});
