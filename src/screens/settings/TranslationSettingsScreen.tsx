import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, Pressable } from 'react-native';
import { TextInput, Portal, RadioButton as PaperRadioButton } from 'react-native-paper';
import { useChapterGeneralSettings, useTheme, useSecureKeys } from '@hooks/persisted';
import { List, Modal, Button, SegmentedControl, SafeAreaView, Appbar } from '@components';
import { getString } from '@strings/translations';
import { ProviderId } from '@services/translation';
import { TranslationSettingsScreenProps } from '@navigators/types';


export interface TextInputModalProps {
  visible: boolean;
  onDismiss: () => void;
  defaultValue?: string;
  onSubmit: (val: string) => void;
  secureTextEntry?: boolean;
  title: string;
}

export const TextInputModal: React.FC<TextInputModalProps> = ({
  visible,
  onDismiss,
  defaultValue = '',
  onSubmit,
  secureTextEntry,
  title,
}) => {
  const theme = useTheme();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (visible) {
      setValue(defaultValue);
    }
  }, [visible, defaultValue]);

  const handleSave = () => {
    onSubmit(value);
    onDismiss();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          {title}
        </Text>
        <TextInput
          value={value}
          onChangeText={setValue}
          mode="outlined"
          secureTextEntry={secureTextEntry}
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
          style={styles.textInput}
        />
        <View style={styles.btnContainer}>
          <Button
            title={getString('common.save')}
            onPress={handleSave}
          />
          <Button title={getString('common.cancel')} onPress={onDismiss} />
        </View>
      </Modal>
    </Portal>
  );
};

export interface ProviderPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  currentProvider: ProviderId;
  onSelect: (provider: ProviderId) => void;
  providers: { id: ProviderId; label: string; note: string }[];
}

export const ProviderPickerModal: React.FC<ProviderPickerModalProps> = ({
  visible,
  onDismiss,
  currentProvider,
  onSelect,
  providers,
}) => {
  const theme = useTheme();

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss}>
        <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
          Translation Provider
        </Text>
        <ScrollView style={styles.scroll}>
          {providers.map(item => (
            <Pressable
              key={item.id}
              android_ripple={{ color: theme.rippleColor }}
              style={styles.providerItem}
              onPress={() => {
                onSelect(item.id);
                onDismiss();
              }}
            >
              <PaperRadioButton
                status={currentProvider === item.id ? 'checked' : 'unchecked'}
                value={item.id}
                onPress={() => {
                  onSelect(item.id);
                  onDismiss();
                }}
                color={theme.primary}
                uncheckedColor={theme.onSurfaceVariant}
              />
              <View style={styles.providerTextContainer}>
                <Text style={[styles.providerLabel, { color: theme.onSurface }]}>
                  {item.label}
                </Text>
                {item.note ? (
                  <Text style={[styles.providerNote, { color: theme.onSurfaceVariant }]}>
                    {item.note}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const PROVIDERS: { id: ProviderId; label: string; note: string }[] = [
  { id: 'gtx',       label: 'Google Translate (Free)',         note: 'No key required — unofficial, may be rate limited' },
  { id: 'google',    label: 'Google Cloud Translate',          note: 'Requires API key' },
  { id: 'deepl',     label: 'DeepL',                           note: 'Requires API key' },
  { id: 'microsoft', label: 'Microsoft Azure Translator',      note: 'Requires API key + region' },
];

const TranslationSettingsScreen = ({ navigation }: TranslationSettingsScreenProps) => {
  const theme = useTheme();
  const {
    translationConfig,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const { googleApiKey, deeplApiKey, microsoftApiKey, setSecureKeys } = useSecureKeys();

  const translationProvider = translationConfig.provider;

  const apiKeyLabel =
    translationProvider === 'google' ? 'Google API Key'
    : translationProvider === 'deepl' ? 'DeepL API Key'
    : translationProvider === 'microsoft' ? 'Azure API Key'
    : '';

  const apiKey =
    translationProvider === 'google' ? googleApiKey
    : translationProvider === 'deepl' ? deeplApiKey
    : translationProvider === 'microsoft' ? microsoftApiKey
    : '';

  const setApiKey = (val: string) => {
    if (translationProvider === 'google') setSecureKeys({ googleApiKey: val });
    else if (translationProvider === 'deepl') setSecureKeys({ deeplApiKey: val });
    else if (translationProvider === 'microsoft') setSecureKeys({ microsoftApiKey: val });
  };

  const [providerVisible, setProviderVisible] = useState(false);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [microsoftRegionVisible, setMicrosoftRegionVisible] = useState(false);

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title="Translation"
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      <ScrollView style={[{ backgroundColor: theme.background }, styles.flex]}>
        <List.Section>
          {/* Provider Picker */}
          <List.Item
            title="Translation Provider"
            description={PROVIDERS.find(p => p.id === translationProvider)?.label || 'Google Translate (Free)'}
            icon="translate"
            onPress={() => setProviderVisible(true)}
            theme={theme}
          />
          <ProviderPickerModal
            visible={providerVisible}
            onDismiss={() => setProviderVisible(false)}
            currentProvider={translationProvider}
            onSelect={val => {
              if (val === 'deepl') {
                setChapterGeneralSettings({
                  translationConfig: { provider: 'deepl', plan: 'free' },
                });
              } else if (val === 'microsoft') {
                setChapterGeneralSettings({
                  translationConfig: { provider: 'microsoft', region: '' },
                });
              } else {
                setChapterGeneralSettings({
                  translationConfig: { provider: val },
                });
              }
            }}
            providers={PROVIDERS}
          />

          {/* Single API key input shared across all providers that require one */}
          {translationProvider !== 'gtx' && (
            <>
              <List.Item
                title={apiKeyLabel}
                description={apiKey ? '••••••••' : 'Not configured'}
                icon="key"
                onPress={() => setApiKeyVisible(true)}
                theme={theme}
              />
              <TextInputModal
                visible={apiKeyVisible}
                onDismiss={() => setApiKeyVisible(false)}
                defaultValue={apiKey}
                onSubmit={setApiKey}
                secureTextEntry
                title={apiKeyLabel}
              />
            </>
          )}

          {/* DeepL plan toggle */}
          {translationConfig.provider === 'deepl' && (
            <View style={styles.segmentedContainer}>
              <Text style={[styles.segmentedLabel, { color: theme.onSurfaceVariant }]}>
                DeepL Plan
              </Text>
              <SegmentedControl
                value={translationConfig.plan}
                onChange={val =>
                  setChapterGeneralSettings({
                    translationConfig: { ...translationConfig, plan: val as 'free' | 'pro' },
                  })
                }
                options={[
                  { value: 'free', label: 'Free' },
                  { value: 'pro', label: 'Pro' },
                ]}
                theme={theme}
              />
            </View>
          )}

          {/* Microsoft region input */}
          {translationConfig.provider === 'microsoft' && (
            <>
              <List.Item
                title="Azure Region"
                description={translationConfig.region || 'e.g. eastus'}
                icon="map-marker"
                onPress={() => setMicrosoftRegionVisible(true)}
                theme={theme}
              />
              <TextInputModal
                visible={microsoftRegionVisible}
                onDismiss={() => setMicrosoftRegionVisible(false)}
                defaultValue={translationConfig.region}
                onSubmit={val =>
                  setChapterGeneralSettings({
                    translationConfig: { ...translationConfig, region: val },
                  })
                }
                title="Azure Region"
              />
            </>
          )}
        </List.Section>
      </ScrollView>
    </SafeAreaView>
  );
};

export default TranslationSettingsScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  btnContainer: {
    flexDirection: 'row-reverse',
    marginTop: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  textInput: {
    fontSize: 14,
    marginVertical: 8,
  },
  scroll: {
    maxHeight: 300,
  },
  providerItem: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  providerTextContainer: {
    marginStart: 12,
    flex: 1,
  },
  providerLabel: {
    fontSize: 16,
  },
  providerNote: {
    fontSize: 12,
    marginTop: 2,
  },
  segmentedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  segmentedLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
});
