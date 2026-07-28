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
  MAX_CHUNK_SIZE,
  MIN_CHUNK_SIZE,
  TARGET_LANGUAGES,
  TRANSLATION_PROVIDER_IDS,
  deleteApiKey,
  getTranslationProvider,
  hasApiKey,
  languageLabel,
  setApiKey,
  testProvider,
  type TranslationProviderId,
} from '@services/translation';
import { showToast } from '@utils/showToast';

import SettingSwitch from '../components/SettingSwitch';
import ChoiceModal, { type Choice } from './ChoiceModal';
import NumberFieldModal from './NumberFieldModal';
import TextFieldModal from './TextFieldModal';
import {
  PROVIDER_CATEGORY,
  PROVIDER_FIELDS,
  PROVIDER_LABELS,
  type ProviderFieldSpec,
} from './providerMeta';

type TranslationSettingsProps = NativeStackScreenProps<
  SettingsStackParamList,
  'TranslationSettings'
>;

const CATEGORY_LABEL_KEYS = {
  freeNoKey: 'translationSettings.categoryFreeNoKey',
  apiKey: 'translationSettings.categoryApiKey',
  selfHosted: 'translationSettings.categorySelfHosted',
  escapeHatch: 'translationSettings.categoryEscapeHatch',
} as const;

/** Bounds for the pacing controls, kept in one place for the modals. */
const DELAY_BOUNDS = { min: 0, max: 60_000 };
const TIMEOUT_BOUNDS = { min: 1, max: 600 };

const SettingsTranslationScreen = ({
  navigation,
}: TranslationSettingsProps) => {
  const theme = useTheme();
  const {
    enabled,
    config,
    targetLang,
    chunkSize,
    requestDelayMs,
    requestTimeoutMs,
    setTranslationSettings,
    setProvider,
    setProviderConfig,
  } = useTranslationSettings();

  const providerModal = useBoolean();
  const languageModal = useBoolean();
  const apiKeyModal = useBoolean();
  const chunkSizeModal = useBoolean();
  const delayModal = useBoolean();
  const timeoutModal = useBoolean();

  const [keyStored, setKeyStored] = useState(false);
  const [testing, setTesting] = useState(false);
  /** Which provider-specific field the text editor is currently editing. */
  const [editingField, setEditingField] = useState<ProviderFieldSpec>();

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

  const runTest = useCallback(async () => {
    setTesting(true);
    try {
      const result = await testProvider(config, targetLang);
      showToast(
        result.ok
          ? getString('translationSettings.testSuccess', {
              text: result.translated,
            })
          : getString('translationSettings.testFailed', {
              reason: result.message,
            }),
      );
    } finally {
      setTesting(false);
    }
  }, [config, targetLang]);

  /** Grouped so the picker reads like the provider table in the spec. */
  const providerChoices = useMemo<Choice<TranslationProviderId>[]>(() => {
    const order = ['freeNoKey', 'apiKey', 'selfHosted', 'escapeHatch'] as const;
    return TRANSLATION_PROVIDER_IDS.slice()
      .sort(
        (a, b) =>
          order.indexOf(PROVIDER_CATEGORY[a]) -
          order.indexOf(PROVIDER_CATEGORY[b]),
      )
      .map(id => ({
        value: id,
        label: `${PROVIDER_LABELS[id]} · ${getString(
          CATEGORY_LABEL_KEYS[PROVIDER_CATEGORY[id]],
        )}`,
      }));
  }, []);

  const fieldValue = useCallback(
    (spec: ProviderFieldSpec): string => {
      // The union has no index signature; each provider only carries the
      // fields its own metadata lists, so a miss reads as an empty field.
      const value = (config as unknown as Record<string, unknown>)[spec.key];
      return typeof value === 'string' ? value : '';
    },
    [config],
  );

  const activeFields = PROVIDER_FIELDS[config.provider];

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
            description={languageLabel(targetLang)}
            onPress={languageModal.setTrue}
            theme={theme}
          />

          {/*
            Only the active provider's fields are rendered, per spec §4: the
            user is never asked to fill in settings for providers they don't
            use. Driven by metadata so this scales with the provider list.
          */}
          {activeFields.map(spec => (
            <List.Item
              key={spec.key}
              title={getString(spec.labelKey)}
              description={fieldValue(spec) || undefined}
              onPress={() => setEditingField(spec)}
              theme={theme}
            />
          ))}
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
          <List.Item
            title={getString('translationSettings.test')}
            description={getString(
              testing
                ? 'translationSettings.testRunning'
                : 'translationSettings.testDesc',
            )}
            onPress={testing ? undefined : () => void runTest()}
            theme={theme}
          />

          <List.SubHeader theme={theme}>
            {getString('translationSettings.queue')}
          </List.SubHeader>
          <List.Item
            title={getString('translationSettings.chunkSize')}
            description={getString('translationSettings.chunkSizeDesc', {
              count: chunkSize,
            })}
            onPress={chunkSizeModal.setTrue}
            theme={theme}
          />
          <List.Item
            title={getString('translationSettings.requestDelay')}
            description={getString('translationSettings.requestDelayDesc', {
              ms: requestDelayMs,
            })}
            onPress={delayModal.setTrue}
            theme={theme}
          />
          <List.Item
            title={getString('translationSettings.requestTimeout')}
            description={getString('translationSettings.requestTimeoutDesc', {
              seconds: Math.round(requestTimeoutMs / 1000),
            })}
            onPress={timeoutModal.setTrue}
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
        title={editingField ? getString(editingField.labelKey) : ''}
        value={editingField ? fieldValue(editingField) : ''}
        multiline={editingField?.multiline}
        keyboardType={editingField?.keyboardType}
        visible={editingField !== undefined}
        onDismiss={() => setEditingField(undefined)}
        onSubmit={value => {
          if (editingField) {
            setProviderConfig({ [editingField.key]: value });
          }
        }}
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
      <NumberFieldModal
        title={getString('translationSettings.chunkSize')}
        description={getString('translationSettings.chunkSizeHint')}
        value={chunkSize}
        min={MIN_CHUNK_SIZE}
        max={MAX_CHUNK_SIZE}
        visible={chunkSizeModal.value}
        onDismiss={chunkSizeModal.setFalse}
        onSubmit={value => setTranslationSettings({ chunkSize: value })}
      />
      <NumberFieldModal
        title={getString('translationSettings.requestDelay')}
        value={requestDelayMs}
        min={DELAY_BOUNDS.min}
        max={DELAY_BOUNDS.max}
        visible={delayModal.value}
        onDismiss={delayModal.setFalse}
        onSubmit={value => setTranslationSettings({ requestDelayMs: value })}
      />
      <NumberFieldModal
        title={getString('translationSettings.requestTimeout')}
        value={Math.round(requestTimeoutMs / 1000)}
        min={TIMEOUT_BOUNDS.min}
        max={TIMEOUT_BOUNDS.max}
        visible={timeoutModal.value}
        onDismiss={timeoutModal.setFalse}
        // Stored in milliseconds, entered in seconds.
        onSubmit={seconds =>
          setTranslationSettings({ requestTimeoutMs: seconds * 1000 })
        }
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
