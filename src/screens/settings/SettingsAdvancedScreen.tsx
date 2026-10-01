import { useState } from 'react';

import { Platform } from 'react-native';

import { deleteCachedNovels, useUserAgent, useTheme } from '@hooks/persisted';
import { showToast } from '@utils/showToast';

import { getString } from '@i18n/translations';
import { useBoolean } from '@hooks';
import ConfirmationDialog from '@components/ConfirmationDialog/ConfirmationDialog';
import {
  deleteReadChaptersFromDb,
  clearUpdates,
} from '@database/queries/ChapterQueries';

import { Dialog, List, TextInput } from '@components';
import SettingsPage from '@screens/settings/components/SettingsPage';
import { AdvancedSettingsScreenProps } from '@navigators/types';
import { getUserAgentSync } from 'react-native-device-info';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { store } from '@plugins/helpers/storage';
import NativeDoh, { DohProviderId } from '@modules/native-doh';
import DohProviderDialog, { DOH_PROVIDERS } from './DohProviderDialog';
import { shareCrashLogs } from '@services/crashLogs';

const AdvancedSettings = ({ navigation }: AdvancedSettingsScreenProps) => {
  const theme = useTheme();
  const [isSharingCrashLogs, setIsSharingCrashLogs] = useState(false);
  const clearCookies = () => {
    CookieManager.clearAll();
    store.clearAll();
    showToast(getString('webview.cookiesCleared'));
  };

  const { userAgent, setUserAgent } = useUserAgent();
  const [userAgentInput, setUserAgentInput] = useState(userAgent);
  const [dohProvider, setDohProvider] = useState<DohProviderId>(
    NativeDoh?.getProvider() ?? 0,
  );
  /**
   * Confirm Clear Database Dialog
   */
  const [clearDatabaseDialog, setClearDatabaseDialog] = useState(false);
  const showClearDatabaseDialog = () => setClearDatabaseDialog(true);
  const hideClearDatabaseDialog = () => setClearDatabaseDialog(false);

  const [clearUpdatesDialog, setClearUpdatesDialog] = useState(false);
  const showClearUpdatesDialog = () => setClearUpdatesDialog(true);
  const hideClearUpdatesDialog = () => setClearUpdatesDialog(false);
  const handleClearUpdates = async () => {
    try {
      await clearUpdates();
      showToast(getString('advancedSettingsScreen.clearUpdatesMessage'));
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  };

  const handleShareCrashLogs = async () => {
    setIsSharingCrashLogs(true);
    try {
      await shareCrashLogs();
    } catch (error) {
      showToast(getString('advancedSettingsScreen.shareCrashLogsFailed'));
    } finally {
      setIsSharingCrashLogs(false);
    }
  };

  const {
    value: deleteReadChaptersDialog,
    setTrue: showDeleteReadChaptersDialog,
    setFalse: hideDeleteReadChaptersDialog,
  } = useBoolean();

  const {
    value: userAgentModalVisible,
    setTrue: showUserAgentModal,
    setFalse: hideUserAgentModal,
  } = useBoolean();

  const {
    value: dohProviderDialogVisible,
    setTrue: showDohProviderDialog,
    setFalse: hideDohProviderDialog,
  } = useBoolean();

  const dohProviderLabel =
    DOH_PROVIDERS.find(provider => provider.id === dohProvider)?.label ??
    DOH_PROVIDERS[0].label;

  return (
    <SettingsPage
      title={getString('advancedSettings')}
      onBack={() => navigation.goBack()}
      overlays={
        <>
          <ConfirmationDialog
            title={getString('advancedSettingsScreen.deleteReadChapters')}
            confirmLabel={getString('common.delete')}
            message={getString(
              'advancedSettingsScreen.deleteReadChaptersDialogTitle',
            )}
            visible={deleteReadChaptersDialog}
            onConfirm={deleteReadChaptersFromDb}
            onDismiss={hideDeleteReadChaptersDialog}
          />
          <ConfirmationDialog
            title={getString('advancedSettingsScreen.clearCachedNovels')}
            confirmLabel={getString('common.clear')}
            message={getString('advancedSettingsScreen.clearDatabaseWarning')}
            visible={clearDatabaseDialog}
            onConfirm={deleteCachedNovels}
            onDismiss={hideClearDatabaseDialog}
          />
          <ConfirmationDialog
            title={getString('advancedSettingsScreen.clearUpdatesTab')}
            confirmLabel={getString('common.clear')}
            message={getString('advancedSettingsScreen.clearUpdatesWarning')}
            visible={clearUpdatesDialog}
            onConfirm={handleClearUpdates}
            onDismiss={hideClearUpdatesDialog}
          />

          <DohProviderDialog
            provider={dohProvider}
            visible={dohProviderDialogVisible}
            onDismiss={hideDohProviderDialog}
            onSelect={setDohProvider}
          />

          <Dialog.Root
            visible={userAgentModalVisible}
            onDismiss={hideUserAgentModal}
          >
            <Dialog.Title>
              {getString('advancedSettingsScreen.userAgent')}
            </Dialog.Title>
            <Dialog.Description>{userAgent}</Dialog.Description>
            <Dialog.Content>
              <TextInput
                minLines={4}
                value={userAgentInput}
                onChangeText={setUserAgentInput}
              />
            </Dialog.Content>
            <Dialog.Actions>
              <Dialog.Action
                onPress={() => {
                  setUserAgent(getUserAgentSync());
                  hideUserAgentModal();
                }}
              >
                {getString('common.reset')}
              </Dialog.Action>
              <Dialog.Action
                onPress={() => {
                  setUserAgent(userAgentInput.trim());
                  hideUserAgentModal();
                }}
              >
                {getString('common.save')}
              </Dialog.Action>
            </Dialog.Actions>
          </Dialog.Root>
        </>
      }
    >
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('advancedSettingsScreen.diagnostics')}
        </List.SubHeader>
        <List.Item
          title={getString('advancedSettingsScreen.shareCrashLogs')}
          description={getString(
            'advancedSettingsScreen.shareCrashLogsDescription',
          )}
          disabled={isSharingCrashLogs}
          onPress={handleShareCrashLogs}
          theme={theme}
        />
      </List.Section>
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('advancedSettingsScreen.dataManagement')}
        </List.SubHeader>
        <List.Item
          title={getString('advancedSettingsScreen.clearCachedNovels')}
          description={getString(
            'advancedSettingsScreen.clearCachedNovelsDesc',
          )}
          onPress={showClearDatabaseDialog}
          theme={theme}
        />
        <List.Item
          title={getString('advancedSettingsScreen.clearUpdatesTab')}
          description={getString('advancedSettingsScreen.clearupdatesTabDesc')}
          onPress={showClearUpdatesDialog}
          theme={theme}
        />
        <List.Item
          title={getString('advancedSettingsScreen.deleteReadChapters')}
          onPress={showDeleteReadChaptersDialog}
          theme={theme}
        />
      </List.Section>
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('advancedSettingsScreen.networking')}
        </List.SubHeader>
        <List.Item
          title={getString('webview.clearCookies')}
          onPress={clearCookies}
          theme={theme}
        />
        {Platform.OS === 'android' && NativeDoh ? (
          <List.Item
            title={getString('advancedSettingsScreen.dnsOverHttps')}
            description={dohProviderLabel}
            onPress={showDohProviderDialog}
            theme={theme}
          />
        ) : null}
        <List.Item
          title={getString('advancedSettingsScreen.userAgent')}
          description={userAgent}
          onPress={showUserAgentModal}
          theme={theme}
        />
      </List.Section>
    </SettingsPage>
  );
};

export default AdvancedSettings;
