import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { List, RadioButton, SwitchItem, TextInput } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import type { StringMap } from '@i18n/types';
import { DEFAULT_GEMINI_MODEL } from '@api/translation/gemini';
import { DEFAULT_OPENAI_MODEL } from '@api/translation/openai';
import {
  TRANSLATION_PROVIDERS,
  type TranslationProvider,
} from '@api/translation/types';
import type { TranslationSettings } from '@api/translation/settings';
import ExpandableSection from './ExpandableSection';

const GEMINI_PRESETS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const OPENAI_PRESETS = [
  'gpt-4o-mini',
  'gpt-4o',
  'mistral-small-latest',
  'deepseek/deepseek-chat',
  'google/gemini-2.0-flash-exp:free',
];

const providerLabel = (provider: string): string =>
  getString(
    `translationSettings.providers.${provider.toLowerCase()}` as keyof StringMap,
  );

const providerDescription = (provider: string): string =>
  getString(
    `translationSettings.providerDescriptions.${provider.toLowerCase()}` as keyof StringMap,
  );

interface CredentialFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  autoCapitalize?: 'none' | 'characters' | 'words' | 'sentences';
  multiline?: boolean;
  onCommit: (value: string) => void;
}

const CredentialField: React.FC<CredentialFieldProps> = ({
  label,
  value,
  placeholder,
  autoCapitalize = 'none',
  multiline,
  onCommit,
}) => {
  const theme = useTheme();
  const [draft, setDraft] = useState(value);

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
        {label}
      </Text>
      <TextInput
        key={value}
        defaultValue={draft}
        onChangeText={setDraft}
        onBlur={() => onCommit(draft.trim())}
        onSubmitEditing={() => onCommit(draft.trim())}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        returnKeyType="done"
        multiline={multiline}
        style={multiline ? styles.multiline : undefined}
      />
    </View>
  );
};

interface NumberFieldProps {
  label: string;
  value: number;
  placeholder?: string;
  onCommit: (value: number) => void;
}

const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  placeholder,
  onCommit,
}) => {
  const theme = useTheme();
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    const parsed = Number.parseInt(draft.replace(/[^\d]/g, ''), 10);
    onCommit(Number.isNaN(parsed) ? 0 : parsed);
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: theme.onSurfaceVariant }]}>
        {label}
      </Text>
      <TextInput
        key={value}
        defaultValue={draft}
        onChangeText={setDraft}
        onBlur={commit}
        onSubmitEditing={commit}
        placeholder={placeholder}
        keyboardType="numeric"
        autoCorrect={false}
        returnKeyType="done"
      />
    </View>
  );
};

const FieldNote: React.FC<{ text: string }> = ({ text }) => {
  const theme = useTheme();
  return (
    <Text style={[styles.fieldNote, { color: theme.onSurfaceVariant }]}>
      {text}
    </Text>
  );
};

interface PresetChipsProps {
  preset: string;
  presets: string[];
  onSelect: (model: string) => void;
}

const PresetChips: React.FC<PresetChipsProps> = ({
  preset,
  presets,
  onSelect,
}) => {
  const theme = useTheme();
  return (
    <View style={styles.presets}>
      {presets.map(model => {
        const selected = model === preset;
        return (
          <Chip
            key={model}
            selected={selected}
            onPress={() => onSelect(model)}
            style={[
              styles.presetChip,
              selected && { backgroundColor: theme.primary },
            ]}
            textStyle={{
              color: selected ? theme.onPrimary : theme.onSurface,
            }}
          >
            {model}
          </Chip>
        );
      })}
    </View>
  );
};

interface ProviderPanelProps {
  provider: TranslationProvider;
  settings: TranslationSettings;
  setTranslationSettings: (values: Partial<TranslationSettings>) => void;
}

const ProviderPanel: React.FC<ProviderPanelProps> = ({
  provider,
  settings,
  setTranslationSettings,
}) => {
  const theme = useTheme();

  if (provider === 'GOOGLE_FREE') {
    return (
      <View style={styles.panel}>
        <List.InfoItem
          title={getString('translationSettings.googleFreeNote')}
          theme={theme}
        />
      </View>
    );
  }

  if (provider === 'GOOGLE_PA') {
    return (
      <View style={styles.panel}>
        <SwitchItem
          theme={theme}
          value={settings.useCommunityGooglePaKey}
          label={getString('translationSettings.useCommunityGooglePaKey')}
          description={getString(
            'translationSettings.useCommunityGooglePaKeyDescription',
          )}
          onPress={() =>
            setTranslationSettings({
              useCommunityGooglePaKey: !settings.useCommunityGooglePaKey,
            })
          }
        />
        <CredentialField
          label={getString('translationSettings.googlePaKeyList')}
          value={settings.googlePaApiKeys}
          placeholder={getString('translationSettings.apiKeyPlaceholder')}
          multiline
          onCommit={googlePaApiKeys =>
            setTranslationSettings({ googlePaApiKeys })
          }
        />
        <FieldNote
          text={getString('translationSettings.googlePaKeyListDescription')}
        />
        <View style={styles.cacheStatus}>
          <List.InfoItem
            title={
              settings.googlePaCachedKey
                ? getString('translationSettings.googlePaCachedKeySet')
                : getString('translationSettings.googlePaCachedKeyNone')
            }
            theme={theme}
          />
        </View>
      </View>
    );
  }

  if (provider === 'GEMINI') {
    return (
      <View style={styles.panel}>
        <CredentialField
          label={getString('translationSettings.apiKey')}
          value={settings.geminiApiKey}
          placeholder={getString('translationSettings.apiKeyPlaceholder')}
          multiline
          onCommit={geminiApiKey => setTranslationSettings({ geminiApiKey })}
        />
        <FieldNote text={getString('translationSettings.multiKeyNote')} />
        <View style={styles.field}>
          <CredentialField
            label={getString('translationSettings.geminiModel')}
            value={settings.geminiModel}
            placeholder={DEFAULT_GEMINI_MODEL}
            onCommit={geminiModel => setTranslationSettings({ geminiModel })}
          />
        </View>
        <PresetChips
          preset={settings.geminiModel}
          presets={GEMINI_PRESETS}
          onSelect={geminiModel => setTranslationSettings({ geminiModel })}
        />
        <NumberField
          label={getString('translationSettings.batchSize')}
          value={settings.batchSize}
          placeholder="60"
          onCommit={batchSize => setTranslationSettings({ batchSize })}
        />
        <FieldNote
          text={getString('translationSettings.batchSizeDescription')}
        />
        <NumberField
          label={getString('translationSettings.maxOutputTokens')}
          value={settings.maxOutputTokens}
          placeholder="0"
          onCommit={maxOutputTokens =>
            setTranslationSettings({ maxOutputTokens })
          }
        />
        <FieldNote
          text={getString('translationSettings.maxOutputTokensDescription')}
        />
      </View>
    );
  }

  return (
    <View style={styles.panel}>
      <CredentialField
        label={getString('translationSettings.openaiEndpoint')}
        value={settings.openaiEndpoint}
        placeholder="https://api.openai.com"
        onCommit={openaiEndpoint => setTranslationSettings({ openaiEndpoint })}
      />
      <View style={styles.field}>
        <CredentialField
          label={getString('translationSettings.apiKey')}
          value={settings.openaiApiKey}
          placeholder={getString('translationSettings.apiKeyPlaceholder')}
          multiline
          onCommit={openaiApiKey => setTranslationSettings({ openaiApiKey })}
        />
      </View>
      <FieldNote text={getString('translationSettings.multiKeyNote')} />
      <View style={styles.field}>
        <CredentialField
          label={getString('translationSettings.openaiModel')}
          value={settings.openaiModel}
          placeholder={DEFAULT_OPENAI_MODEL}
          onCommit={openaiModel => setTranslationSettings({ openaiModel })}
        />
      </View>
      <PresetChips
        preset={settings.openaiModel}
        presets={OPENAI_PRESETS}
        onSelect={openaiModel => setTranslationSettings({ openaiModel })}
      />
      <NumberField
        label={getString('translationSettings.batchSize')}
        value={settings.batchSize}
        placeholder="60"
        onCommit={batchSize => setTranslationSettings({ batchSize })}
      />
      <FieldNote text={getString('translationSettings.batchSizeDescription')} />
      <NumberField
        label={getString('translationSettings.maxOutputTokens')}
        value={settings.maxOutputTokens}
        placeholder="0"
        onCommit={maxOutputTokens =>
          setTranslationSettings({ maxOutputTokens })
        }
      />
      <FieldNote
        text={getString('translationSettings.maxOutputTokensDescription')}
      />
    </View>
  );
};

interface ProviderSettingsPanelProps {
  /** Active provider, shown as the selected radio entry. */
  provider: TranslationProvider;
  settings: TranslationSettings;
  setTranslationSettings: (values: Partial<TranslationSettings>) => void;
}

/**
 * NoveLA-style provider picker: a radio list of translation services where
 * selecting a provider expands an inline credentials panel (API key, base URL,
 * model presets). Reused by the translation settings screen and the reader
 * bottom sheet so base URL/key/model are editable from both places.
 */
const ProviderSettingsPanel: React.FC<ProviderSettingsPanelProps> = ({
  provider,
  settings,
  setTranslationSettings,
}) => {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      {TRANSLATION_PROVIDERS.map(item => {
        const selected = item === provider;
        return (
          <View key={item}>
            <RadioButton
              label={providerLabel(item)}
              status={selected}
              theme={theme}
              onPress={() =>
                selected
                  ? undefined
                  : setTranslationSettings({ provider: item })
              }
            />
            <Text
              style={[styles.description, { color: theme.onSurfaceVariant }]}
            >
              {providerDescription(item)}
            </Text>
            <ExpandableSection expanded={selected}>
              <ProviderPanel
                provider={item}
                settings={settings}
                setTranslationSettings={setTranslationSettings}
              />
            </ExpandableSection>
          </View>
        );
      })}
    </View>
  );
};

export default ProviderSettingsPanel;

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 56,
    paddingVertical: 2,
  },
  panel: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  field: {
    marginTop: 10,
  },
  fieldLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 4,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  fieldNote: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 6,
  },
  cacheStatus: {
    marginTop: 8,
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
  },
  presetChip: {
    marginEnd: 6,
    marginBottom: 6,
  },
});
