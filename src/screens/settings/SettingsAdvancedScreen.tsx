import { useState } from 'react';

import { TextInput } from 'react-native-paper';

import { deleteCachedNovels, useTheme, useUserAgent } from '@hooks/persisted';
import { showToast } from '@utils/showToast';

import { getString } from '@i18n/translations';
import { useBoolean } from '@hooks';
import ConfirmationDialog from '@components/ConfirmationDialog/ConfirmationDialog';
import {
  deleteReadChaptersFromDb,
  clearUpdates,
} from '@database/queries/ChapterQueries';

import { Appbar, Dialog, List, SafeAreaView } from '@components';
import { AdvancedSettingsScreenProps } from '@navigators/types';
import { ScrollView, StyleSheet } from 'react-native';
import { getUserAgentSync } from 'react-native-device-info';
import CookieManager from '@preeternal/react-native-cookie-manager';
import { store } from '@plugins/helpers/storage';

const AdvancedSettings = ({ navigation }: AdvancedSettingsScreenProps) => {
  const theme = useTheme();
  const clearCookies = () => {
    CookieManager.clearAll();
    store.clearAll();
    showToast(getString('webview.cookiesCleared'));
  };

  const { userAgent, setUserAgent } = useUserAgent();
  const [userAgentInput, setUserAgentInput] = useState(userAgent);
  /**
   * Confirm Clear Database Dialog
   */
  const [clearDatabaseDialog, setClearDatabaseDialog] = useState(false);
  const showClearDatabaseDialog = () => setClearDatabaseDialog(true);
  const hideClearDatabaseDialog = () => setClearDatabaseDialog(false);

  const [clearUpdatesDialog, setClearUpdatesDialog] = useState(false);
  const showClearUpdatesDialog = () => setClearUpdatesDialog(true);
  const hideClearUpdatesDialog = () => setClearUpdatesDialog(false);

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

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('advancedSettings')}
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      <ScrollView>
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
            description={getString(
              'advancedSettingsScreen.clearupdatesTabDesc',
            )}
            onPress={showClearUpdatesDialog}
            theme={theme}
          />
          <List.Item
            title={getString('advancedSettingsScreen.deleteReadChapters')}
            onPress={showDeleteReadChaptersDialog}
            theme={theme}
          />
          <List.Item
            title={getString('webview.clearCookies')}
            onPress={clearCookies}
            theme={theme}
          />
          <List.Item
            title={getString('advancedSettingsScreen.userAgent')}
            description={userAgent}
            onPress={showUserAgentModal}
            theme={theme}
          />
        </List.Section>
      </ScrollView>
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
        onConfirm={() => {
          clearUpdates();
          showToast(getString('advancedSettingsScreen.clearUpdatesMessage'));
          hideClearUpdatesDialog();
        }}
        onDismiss={hideClearUpdatesDialog}
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
            multiline
            mode="outlined"
            defaultValue={userAgent}
            onChangeText={text => setUserAgentInput(text.trim())}
            placeholderTextColor={theme.onSurfaceDisabled}
            underlineColor={theme.outline}
            style={[{ color: theme.onSurface }, styles.textInput]}
            theme={{ colors: { ...theme } }}
          />
        </Dialog.Content>
        <Dialog.Actions>
          <Dialog.Action
            onPress={() => {
              setUserAgent(getUserAgentSync());
              hideUserAgentModal();
            }}
            title={getString('common.reset')}
          />
          <Dialog.Action
            onPress={() => {
              setUserAgent(userAgentInput);
              hideUserAgentModal();
            }}
            title={getString('common.save')}
          />
        </Dialog.Actions>
      </Dialog.Root>
    </SafeAreaView>
  );
};

export default AdvancedSettings;

const styles = StyleSheet.create({
  textInput: {
    borderRadius: 14,
    fontSize: 12,
    height: 120,
  },
});
