import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Appbar, List, SafeAreaView } from '@components';
import { useBoolean } from '@hooks';
import { useTheme } from '@hooks/persisted';
import { useTranslationSettings } from '@hooks/persisted/useTranslationSettings';
import { getString } from '@i18n/translations';
import { SettingsStackParamList } from '@navigators/types';
import {
  TRANSLATION_PROVIDER_IDS,
  deleteApiKey,
  getTranslationProvider,
  hasApiKey,
  setApiKey,
  type TranslationProviderId,
} from '@services/translation';
import { showToast } from '@utils/showToast';

import SettingSwitch from '../components/SettingSwitch';
import ChoiceModal, { type Choice } from './ChoiceModal';
import TextFieldModal from './TextFieldModal';

/**
 * Provider display names are product names, so they are intentionally not
 * translated.
 */
const PROVIDER_LABELS: Record<TranslationProviderId, string> = {
  libretranslate: 'LibreTranslate',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
};

/**
 * Target languages offered in Phase 1. Deliberately a curated list rather than
 * every ISO code: the providers disagree on which they accept, and an
 * unsupported code fails at request time with a provider-specific error.
 */
const TARGET_LANGUAGES: Choice<string>[] = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
  { value: 'ru', label: 'Русский' },
  { value: 'tr', label: 'Türkçe' },
  { value: 'ar', label: 'العربية' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'id', label: 'Bahasa Indonesia' },
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'th', label: 'ไทย' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
];

type TranslationSettingsProps = NativeStackScreenProps<
  SettingsStackParamList,
  'TranslationSettings'
>;

const SettingsTranslationScreen = ({
  navigation,
}: TranslationSettingsProps) => {
  const theme = useTheme();
  const {
    enabled,
    config,
    targetLang,
    setTranslationSettings,
    setProvider,
    setProviderConfig,
  } = useTranslationSettings();

  const providerModal = useBoolean();
  const languageModal = useBoolean();
  const apiKeyModal = useBoolean();
  const endpointModal = useBoolean();
  const modelModal = useBoolean();

  const [keyStored, setKeyStored] = useState(false);

  const provider = useMemo(
    () => getTranslationProvider(config.provider),
    [config.provider],
  );
  const keyRequired = provider.requiresApiKey(config);

  /**
   * Only ever reports *whether* a key exists — the value itself stays in the
   * encrypted store and is never read back into component state.
   */
  const refreshKeyStatus = useCallback(() => {
    let cancelled = false;
    hasApiKey(config.provider)
      .then(present => !cancelled && setKeyStored(present))
      .catch(() => !cancelled && setKeyStored(false));
    return () => {
      cancelled = true;
    };
  }, [config.provider]);

  useEffect(() => refreshKeyStatus(), [refreshKeyStatus]);

  const saveApiKey = useCallback(
    async (value: string) => {
      try {
        if (value) {
          await setApiKey(config.provider, value);
        } else {
          await deleteApiKey(config.provider);
        }
        refreshKeyStatus();
      } catch {
        showToast(getString('translationSettings.keyStoreUnavailable'));
      }
    },
    [config.provider, refreshKeyStatus],
  );

  const providerChoices = useMemo<Choice<TranslationProviderId>[]>(
    () =>
      TRANSLATION_PROVIDER_IDS.map(id => ({
        value: id,
        label: PROVIDER_LABELS[id],
      })),
    [],
  );

  const languageLabel =
    TARGET_LANGUAGES.find(l => l.value === targetLang)?.label ?? targetLang;

  const hasEndpoint =
    config.provider === 'libretranslate' || config.provider === 'ollama';
  const hasModel = config.provider === 'gemini' || config.provider === 'ollama';

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('translationSettings.title')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView contentContainerStyle={styles.paddingBottom}>
        <List.Section>
          <SettingSwitch
            label={getString('translationSettings.enable')}
            description={getString('translationSettings.enableDesc')}
            value={enabled}
            onPress={() => setTranslationSettings({ enabled: !enabled })}
            theme={theme}
          />

          <List.SubHeader theme={theme}>
            {getString('translationSettings.provider')}
          </List.SubHeader>
          <List.Item
            title={getString('translationSettings.provider')}
            description={PROVIDER_LABELS[config.provider]}
            onPress={providerModal.setTrue}
            theme={theme}
          />
          <List.Item
            title={getString('translationSettings.targetLanguage')}
            description={languageLabel}
            onPress={languageModal.setTrue}
            theme={theme}
          />

          {/*
            Only the active provider's fields are shown, per spec §4: the user
            is never asked to fill in credentials for providers they don't use.
          */}
          {hasEndpoint ? (
            <List.Item
              title={getString('translationSettings.serverUrl')}
              description={'endpoint' in config ? config.endpoint : undefined}
              onPress={endpointModal.setTrue}
              theme={theme}
            />
          ) : null}
          {hasModel ? (
            <List.Item
              title={getString('translationSettings.model')}
              description={'model' in config ? config.model : undefined}
              onPress={modelModal.setTrue}
              theme={theme}
            />
          ) : null}
          <List.Item
            title={getString('translationSettings.apiKey')}
            description={getString(
              keyStored
                ? 'translationSettings.apiKeySet'
                : keyRequired
                ? 'translationSettings.apiKeyRequired'
                : 'translationSettings.apiKeyOptional',
            )}
            onPress={apiKeyModal.setTrue}
            theme={theme}
          />
        </List.Section>
      </ScrollView>

      <ChoiceModal
        title={getString('translationSettings.provider')}
        choices={providerChoices}
        selected={config.provider}
        visible={providerModal.value}
        onDismiss={providerModal.setFalse}
        onSelect={setProvider}
      />
      <ChoiceModal
        title={getString('translationSettings.targetLanguage')}
        choices={TARGET_LANGUAGES}
        selected={targetLang}
        visible={languageModal.value}
        onDismiss={languageModal.setFalse}
        onSelect={value => setTranslationSettings({ targetLang: value })}
      />
      <TextFieldModal
        title={getString('translationSettings.serverUrl')}
        value={'endpoint' in config ? config.endpoint : ''}
        keyboardType="url"
        visible={endpointModal.value}
        onDismiss={endpointModal.setFalse}
        onSubmit={endpoint => endpoint && setProviderConfig({ endpoint })}
      />
      <TextFieldModal
        title={getString('translationSettings.model')}
        value={'model' in config ? config.model : ''}
        visible={modelModal.value}
        onDismiss={modelModal.setFalse}
        onSubmit={model => model && setProviderConfig({ model })}
      />
      <TextFieldModal
        title={getString('translationSettings.apiKey')}
        description={getString('translationSettings.apiKeyDesc')}
        // Never seeded with the stored key: it is write-only from the UI's
        // point of view. Submitting an empty field clears it.
        value=""
        secure
        visible={apiKeyModal.value}
        onDismiss={apiKeyModal.setFalse}
        onSubmit={value => void saveApiKey(value)}
      />
    </SafeAreaView>
  );
};

export default SettingsTranslationScreen;

const styles = StyleSheet.create({
  paddingBottom: {
    paddingBottom: 40,
  },
});
