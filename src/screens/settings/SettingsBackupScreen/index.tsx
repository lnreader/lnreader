import { useAppSettings, useTheme } from '@hooks/persisted';
import { List } from '@components';
import SettingsPage from '@screens/settings/components/SettingsPage';
import { useBoolean } from '@hooks';
import { BackupSettingsScreenProps } from '@navigators/types';
import GoogleDriveModal from './Components/GoogleDriveModal';
import SelfHostModal from './Components/SelfHostModal';
import {
  backgroundTasks,
  configureAutomaticBackups,
  type AutomaticBackupInterval,
} from '@services/backgroundTasks';
import { getString } from '@i18n/translations';
import dayjs from 'dayjs';
import NativeFile from '@modules/native-file';
import { useState } from 'react';
import {
  DEFAULT_BACKUP_OPTIONS,
  type BackupOptions,
} from '@services/backup/options';
import { BackupOptionsDialog } from './Components/BackupOptions';
import AutomaticBackupDialog, {
  AUTOMATIC_BACKUP_LABELS,
} from './Components/AutomaticBackupDialog';
import { showToast } from '@utils/showToast';

const BackupSettings = ({ navigation }: BackupSettingsScreenProps) => {
  const theme = useTheme();
  const {
    automaticBackupIntervalHours = 0,
    automaticBackupDirectoryName,
    automaticBackupDirectoryUri,
    lastAutomaticBackupAt,
    setAppSettings,
  } = useAppSettings();
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    ...DEFAULT_BACKUP_OPTIONS,
  });
  const {
    value: backupOptionsVisible,
    setFalse: closeBackupOptions,
    setTrue: openBackupOptions,
  } = useBoolean();
  const automaticBackupDialog = useBoolean();
  const {
    value: googleDriveModalVisible,
    setFalse: closeGoogleDriveModal,
    setTrue: openGoogleDriveModal,
  } = useBoolean();

  const setAutomaticBackupInterval = async (
    intervalHours: AutomaticBackupInterval,
  ) => {
    try {
      await configureAutomaticBackups(
        intervalHours,
        automaticBackupDirectoryUri,
      );
      setAppSettings({ automaticBackupIntervalHours: intervalHours });
      automaticBackupDialog.setFalse();
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  };

  const selectAutomaticBackupDirectory = async () => {
    let directory: Awaited<ReturnType<typeof NativeFile.pickDirectory>>;
    try {
      directory = await NativeFile.pickDirectory();
    } catch {
      // Closing Android's directory picker intentionally keeps the old location.
      return;
    }

    try {
      if (automaticBackupIntervalHours !== 0) {
        await configureAutomaticBackups(
          automaticBackupIntervalHours,
          directory.uri,
        );
      }
      setAppSettings({
        automaticBackupDirectoryName: directory.name,
        automaticBackupDirectoryUri: directory.uri,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : String(error));
    }
  };

  const createLocalBackup = () => {
    setBackupOptions({ ...DEFAULT_BACKUP_OPTIONS });
    openBackupOptions();
  };

  const chooseLocalBackupDestination = async () => {
    closeBackupOptions();
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
        data: { destinationUri, options: backupOptions },
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
    <SettingsPage
      title={getString('common.backup')}
      onBack={() => navigation.goBack()}
      overlays={
        <>
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
          <BackupOptionsDialog
            onCancel={closeBackupOptions}
            onChange={setBackupOptions}
            onConfirm={chooseLocalBackupDestination}
            options={backupOptions}
            theme={theme}
            visible={backupOptionsVisible}
          />
          <AutomaticBackupDialog
            intervalHours={automaticBackupIntervalHours}
            visible={automaticBackupDialog.value}
            onCancel={automaticBackupDialog.setFalse}
            onSelect={setAutomaticBackupInterval}
          />
        </>
      }
    >
      <List.Section>
        <List.SubHeader theme={theme}>
          {getString('backupScreen.remoteBackup')}
        </List.SubHeader>
        <List.Item
          title={getString('backupScreen.selfHost')}
          description={getString('backupScreen.selfHostDesc')}
          onPress={openSelfHostModal}
          theme={theme}
        />

        <List.Item
          title={getString('backupScreen.googeDrive')}
          description={getString('backupScreen.googeDriveDesc')}
          onPress={openGoogleDriveModal}
          theme={theme}
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
        <List.Item
          title={getString('backupScreen.automaticBackupFrequency')}
          description={getString(
            AUTOMATIC_BACKUP_LABELS[automaticBackupIntervalHours],
          )}
          onPress={automaticBackupDialog.setTrue}
          theme={theme}
        />
        <List.Item
          title={getString('backupScreen.automaticBackupLocation')}
          description={
            automaticBackupDirectoryName ??
            `${NativeFile.ExternalDirectoryPath}/Backups`
          }
          onPress={selectAutomaticBackupDirectory}
          theme={theme}
        />
        {lastAutomaticBackupAt ? (
          <List.InfoItem
            title={getString('backupScreen.lastAutomaticBackup', {
              time: dayjs(lastAutomaticBackupAt).fromNow(),
            })}
            theme={theme}
          />
        ) : null}
      </List.Section>
    </SettingsPage>
  );
};

export default BackupSettings;
