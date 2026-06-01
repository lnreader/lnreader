import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Portal, Text, TextInput } from 'react-native-paper';
import { Appbar, Button, List, Modal, SafeAreaView } from '@components';
import { useTheme, useTranslateSettings } from '@hooks/persisted';
import {
  getProviderApiKey,
  setProviderApiKey,
} from '@hooks/persisted/useTranslateSettings';
import {
  LanguagePickerModal,
  LANGUAGES,
} from '@screens/reader/components/ReaderBottomSheet/TranslateTab';
import SettingSwitch from './components/SettingSwitch';
import { getString } from '@strings/translations';
import { PROVIDER_LIST, ProviderId } from '@services/translate/types';
import { showToast } from '@utils/showToast';

const AZURE_REGIONS = [
  { code: 'global', label: 'Global' },
  { code: 'australiaeast', label: 'Australia East' },
  { code: 'brazilsouth', label: 'Brazil South' },
  { code: 'canadacentral', label: 'Canada Central' },
  { code: 'centralindia', label: 'Central India' },
  { code: 'eastus', label: 'East US' },
  { code: 'eastus2', label: 'East US 2' },
  { code: 'francecentral', label: 'France Central' },
  { code: 'germanywestcentral', label: 'Germany West Central' },
  { code: 'japaneast', label: 'Japan East' },
  { code: 'koreacentral', label: 'Korea Central' },
  { code: 'northcentralus', label: 'North Central US' },
  { code: 'northeurope', label: 'North Europe' },
  { code: 'southcentralus', label: 'South Central US' },
  { code: 'southeastasia', label: 'Southeast Asia' },
  { code: 'switzerlandnorth', label: 'Switzerland North' },
  { code: 'uksouth', label: 'UK South' },
  { code: 'westeurope', label: 'West Europe' },
  { code: 'westus2', label: 'West US 2' },
];

const SettingsTranslateScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const {
    translateEnabled,
    translateMode,
    translateTargetLanguage,
    translateProvider,
    deeplPlan,
    microsoftRegion,
    setTranslateSettings,
  } = useTranslateSettings();

  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [providerModalVisible, setProviderModalVisible] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [regionModalVisible, setRegionModalVisible] = useState(false);
  const [customRegionModalVisible, setCustomRegionModalVisible] =
    useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [customRegionInput, setCustomRegionInput] = useState('');

  const currentProvider = PROVIDER_LIST.find(
    p => p.id === (translateProvider ?? 'gtx'),
  )!;

  // Load the current API key when modal opens
  useEffect(() => {
    if (apiKeyModalVisible) {
      setApiKeyInput(getProviderApiKey(translateProvider ?? 'gtx'));
    }
  }, [apiKeyModalVisible, translateProvider]);

  const getLanguageLabel = (code: string) => {
    const lang = LANGUAGES.find(l => l.code === code);
    return lang ? lang.label : code.toUpperCase();
  };

  const handleSaveApiKey = () => {
    setProviderApiKey(translateProvider ?? 'gtx', apiKeyInput);
    setApiKeyModalVisible(false);
    if (apiKeyInput.trim().length > 0) {
      showToast(getString('translation.apiKeySaved'));
    } else {
      showToast(getString('translation.apiKeyCleared'));
    }
  };

  const getProviderDescription = (id: ProviderId): string => {
    switch (id) {
      case 'gtx':
        return getString('translation.providerGtxDesc');
      case 'google':
        return getString('translation.providerGoogleDesc');
      case 'deepl':
        return getString('translation.providerDeepLDesc');
      case 'microsoft':
        return getString('translation.providerMicrosoftDesc');
      default:
        return '';
    }
  };

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('translation.settings')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView
        contentContainerStyle={styles.paddingBottom}
        style={{ backgroundColor: theme.background }}
      >
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('translation.generalOptions')}
          </List.SubHeader>

          <SettingSwitch
            label={getString('translation.enableTranslation')}
            description={getString('translation.enableTranslationDesc')}
            value={translateEnabled}
            onPress={() =>
              setTranslateSettings({ translateEnabled: !translateEnabled })
            }
            theme={theme}
          />

          {translateEnabled && (
            <>
              <List.Item
                title={getString('translation.defaultTargetLanguage')}
                description={getLanguageLabel(translateTargetLanguage)}
                onPress={() => setLanguageModalVisible(true)}
                theme={theme}
              />

              <List.SubHeader theme={theme}>
                {getString('translation.defaultTranslationLayout')}
              </List.SubHeader>

              <List.Item
                title={getString('translation.dualText')}
                description={getString('translation.dualTextDesc')}
                onPress={() => setTranslateSettings({ translateMode: 'dual' })}
                right={translateMode === 'dual' ? 'check' : undefined}
                theme={theme}
              />

              <List.Item
                title={getString('translation.translatedOnly')}
                description={getString('translation.translatedOnlyDesc')}
                onPress={() =>
                  setTranslateSettings({ translateMode: 'translated' })
                }
                right={translateMode === 'translated' ? 'check' : undefined}
                theme={theme}
              />

              <List.Divider theme={theme} />
              <List.SubHeader theme={theme}>
                {getString('translation.translationProvider')}
              </List.SubHeader>

              <List.Item
                title={getString('translation.provider')}
                description={`${
                  currentProvider.label
                }\n${getProviderDescription(currentProvider.id)}`}
                onPress={() => setProviderModalVisible(true)}
                theme={theme}
              />

              {/* API Key — only shown for providers that need one */}
              {currentProvider.requiresKey && (
                <List.Item
                  title={getString('translation.apiKey')}
                  description={
                    getProviderApiKey(translateProvider ?? 'gtx')
                      ? '••••••••' +
                        getProviderApiKey(translateProvider ?? 'gtx').slice(-4)
                      : getString('translation.apiKeyDesc')
                  }
                  onPress={() => setApiKeyModalVisible(true)}
                  theme={theme}
                />
              )}

              {/* DeepL Plan toggle */}
              {translateProvider === 'deepl' && (
                <List.Item
                  title={getString('translation.deeplPlan')}
                  description={
                    deeplPlan === 'pro'
                      ? getString('translation.deeplPlanPro')
                      : getString('translation.deeplPlanFree')
                  }
                  onPress={() =>
                    setTranslateSettings({
                      deeplPlan: deeplPlan === 'pro' ? 'free' : 'pro',
                    })
                  }
                  theme={theme}
                />
              )}

              {/* Microsoft Region input */}
              {translateProvider === 'microsoft' && (
                <List.Item
                  title={getString('translation.microsoftRegion')}
                  description={
                    AZURE_REGIONS.find(r => r.code === microsoftRegion)
                      ?.label ||
                    microsoftRegion ||
                    getString('translation.microsoftRegionDesc')
                  }
                  onPress={() => setRegionModalVisible(true)}
                  theme={theme}
                />
              )}
            </>
          )}
        </List.Section>
      </ScrollView>

      <LanguagePickerModal
        visible={languageModalVisible}
        onDismiss={() => setLanguageModalVisible(false)}
        currentLanguage={translateTargetLanguage}
        onSelect={code =>
          setTranslateSettings({ translateTargetLanguage: code })
        }
      />

      {/* Provider Picker Modal */}
      <Portal>
        <Modal
          visible={providerModalVisible}
          onDismiss={() => setProviderModalVisible(false)}
        >
          <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
            {getString('translation.selectProvider')}
          </Text>
          {PROVIDER_LIST.map(provider => (
            <List.Item
              key={provider.id}
              title={provider.label}
              description={getProviderDescription(provider.id)}
              onPress={() => {
                setTranslateSettings({ translateProvider: provider.id });
                setProviderModalVisible(false);
              }}
              right={
                (translateProvider ?? 'gtx') === provider.id
                  ? 'check'
                  : undefined
              }
              theme={theme}
            />
          ))}
        </Modal>
      </Portal>

      {/* API Key Modal */}
      <Portal>
        <Modal
          visible={apiKeyModalVisible}
          onDismiss={() => setApiKeyModalVisible(false)}
        >
          <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
            {getString('translation.apiKey')} — {currentProvider.label}
          </Text>
          <TextInput
            mode="outlined"
            value={apiKeyInput}
            onChangeText={setApiKeyInput}
            placeholder={getString('translation.apiKeyDesc')}
            placeholderTextColor={theme.onSurfaceDisabled}
            underlineColor={theme.outline}
            style={[{ color: theme.onSurface }, styles.textInput]}
            theme={{ colors: { ...theme } }}
            secureTextEntry
          />
          <View style={styles.buttonGroup}>
            <Button
              onPress={() => {
                handleSaveApiKey();
              }}
              style={styles.button}
              title={getString('common.save')}
              mode="contained"
            />
            <Button
              style={styles.button}
              onPress={() => {
                setApiKeyInput('');
                setProviderApiKey(translateProvider ?? 'gtx', '');
                setApiKeyModalVisible(false);
                showToast(getString('translation.apiKeyCleared'));
              }}
              title={getString('common.reset')}
            />
          </View>
        </Modal>
      </Portal>

      {/* Microsoft Region Picker Modal */}
      <Portal>
        <Modal
          visible={regionModalVisible}
          onDismiss={() => setRegionModalVisible(false)}
          contentContainerStyle={styles.scrollModal}
        >
          <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
            {getString('translation.microsoftRegion')}
          </Text>
          <ScrollView style={styles.regionScrollList}>
            {AZURE_REGIONS.map(r => (
              <List.Item
                key={r.code}
                title={r.label}
                description={r.code}
                onPress={() => {
                  setTranslateSettings({ microsoftRegion: r.code });
                  setRegionModalVisible(false);
                }}
                right={microsoftRegion === r.code ? 'check' : undefined}
                theme={theme}
              />
            ))}
            <List.Item
              title="Custom..."
              description="Enter a custom Azure region identifier"
              onPress={() => {
                setCustomRegionInput(microsoftRegion || '');
                setRegionModalVisible(false);
                setCustomRegionModalVisible(true);
              }}
              right={
                AZURE_REGIONS.every(r => r.code !== microsoftRegion) &&
                microsoftRegion
                  ? 'check'
                  : undefined
              }
              theme={theme}
            />
          </ScrollView>
        </Modal>
      </Portal>

      {/* Custom Region Modal */}
      <Portal>
        <Modal
          visible={customRegionModalVisible}
          onDismiss={() => setCustomRegionModalVisible(false)}
        >
          <Text style={[styles.modalTitle, { color: theme.onSurface }]}>
            Custom Azure Region
          </Text>
          <TextInput
            mode="outlined"
            value={customRegionInput}
            onChangeText={setCustomRegionInput}
            placeholder="e.g. francecentral"
            placeholderTextColor={theme.onSurfaceDisabled}
            underlineColor={theme.outline}
            style={[{ color: theme.onSurface }, styles.textInput]}
            theme={{ colors: { ...theme } }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.buttonGroup}>
            <Button
              onPress={() => {
                setTranslateSettings({
                  microsoftRegion: customRegionInput.trim().toLowerCase(),
                });
                setCustomRegionModalVisible(false);
              }}
              style={styles.button}
              title={getString('common.save')}
              mode="contained"
            />
            <Button
              style={styles.button}
              onPress={() => setCustomRegionModalVisible(false)}
              title={getString('common.cancel')}
            />
          </View>
        </Modal>
      </Portal>
    </SafeAreaView>
  );
};

export default SettingsTranslateScreen;

const styles = StyleSheet.create({
  paddingBottom: { paddingBottom: 32 },
  modalTitle: {
    fontSize: 24,
    marginBottom: 16,
  },
  textInput: {
    borderRadius: 14,
    fontSize: 14,
    marginBottom: 8,
    marginTop: 8,
  },
  regionLabel: {
    fontSize: 16,
    marginTop: 12,
    marginBottom: 4,
  },
  button: {
    flex: 1,
    marginHorizontal: 8,
    marginTop: 16,
  },
  buttonGroup: {
    flexDirection: 'row-reverse',
  },
  scrollModal: {
    maxHeight: '85%',
  },
  regionScrollList: {
    marginTop: 8,
  },
});
