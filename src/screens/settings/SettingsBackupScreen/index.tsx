import React from 'react';
import { useTheme } from '@hooks/persisted';
import { Appbar, List, SafeAreaView } from '@components';
import { useBoolean } from '@hooks';
import { BackupSettingsScreenProps } from '@navigators/types';
import GoogleDriveModal from './Components/GoogleDriveModal';
import SelfHostModal from './Components/SelfHostModal';
import { backgroundTasks } from '@services/backgroundTasks';
import { ScrollView } from 'react-native-gesture-handler';
import { getString } from '@strings/translations';
import { StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import NativeFile from '@modules/native-file';

const BackupSettings = ({ navigation }: BackupSettingsScreenProps) => {
  const theme = useTheme();
  const {
    value: googleDriveModalVisible,
    setFalse: closeGoogleDriveModal,
    setTrue: openGoogleDriveModal,
  } = useBoolean();

  const createLocalBackup = async () => {
    try {
      const filename = `lnreader_backup_${dayjs().format(
        'YYYY-MM-DD_HH_mm',
      )}.zip`;
      const destinationUri = await NativeFile.createDocument(
        filename,
        'application/zip',
      );
      backgroundTasks.enqueue({
        name: 'LOCAL_BACKUP',
        data: { destinationUri },
      });
    } catch {
      // Closing Android's document picker intentionally leaves the queue unchanged.
    }
  };

  const restoreLocalBackup = async () => {
    try {
      const sourceUri = await NativeFile.pickDocument('application/zip');
      backgroundTasks.enqueue({
        name: 'LOCAL_RESTORE',
        data: { sourceUri },
      });
    } catch {
      // Closing Android's document picker intentionally leaves the queue unchanged.
    }
  };

  const {
    value: selfHostModalVisible,
    setFalse: closeSelfHostModal,
    setTrue: openSelfHostModal,
  } = useBoolean();

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('common.backup')}
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      <ScrollView style={styles.paddingBottom}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('backupScreen.remoteBackup')}
          </List.SubHeader>
          <List.Item
            title={getString('backupScreen.selfHost')}
            description={getString('backupScreen.selfHostDesc')}
            theme={theme}
            onPress={openSelfHostModal}
          />

          <List.Item
            title={getString('backupScreen.googeDrive')}
            description={getString('backupScreen.googeDriveDesc')}
            theme={theme}
            onPress={openGoogleDriveModal}
          />
          <List.SubHeader theme={theme}>
            {getString('backupScreen.localBackup')}
          </List.SubHeader>
          <List.Item
            title={getString('backupScreen.createBackup')}
            description={getString('backupScreen.createBackupDesc')}
            onPress={createLocalBackup}
            theme={theme}
          />
          <List.Item
            title={getString('backupScreen.restoreBackup')}
            description={getString('backupScreen.restoreBackupDesc')}
            onPress={restoreLocalBackup}
            theme={theme}
          />
          <List.InfoItem
            title={getString('backupScreen.restoreLargeBackupsWarning')}
            theme={theme}
          />
          <List.InfoItem
            title={getString('backupScreen.createBackupWarning')}
            theme={theme}
          />
        </List.Section>
      </ScrollView>
      <GoogleDriveModal
        visible={googleDriveModalVisible}
        theme={theme}
        closeModal={closeGoogleDriveModal}
      />
      <SelfHostModal
        theme={theme}
        visible={selfHostModalVisible}
        closeModal={closeSelfHostModal}
      />
    </SafeAreaView>
  );
};

export default BackupSettings;

const styles = StyleSheet.create({
  paddingBottom: { paddingBottom: 40 },
});
