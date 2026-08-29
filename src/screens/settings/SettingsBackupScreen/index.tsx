import { useAppSettings, useTheme } from '@hooks/persisted';
import { Appbar, ConfirmationDialog, List, SafeAreaView } from '@components';
import { useBoolean } from '@hooks';
import { DataStorageSettingsScreenProps } from '@navigators/types';
import GoogleDriveModal from './Components/GoogleDriveModal';
import SelfHostModal from './Components/SelfHostModal';
import {
  BACKGROUND_TASKS_STORE_KEY,
  backgroundTasks,
  configureAutomaticBackups,
  type AutomaticBackupInterval,
  type QueuedBackgroundTask as BackgroundTaskRecord,
} from '@services/backgroundTasks';
import { ScrollView } from 'react-native-gesture-handler';
import { getString } from '@i18n/translations';
import { StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import NativeFile from '@modules/native-file';
import { useState } from 'react';
import { Portal } from 'react-native-paper';
import {
  DEFAULT_BACKUP_OPTIONS,
  type BackupOptions,
} from '@services/backup/options';
import { BackupOptionsDialog } from './Components/BackupOptions';
import AutomaticBackupDialog, {
  AUTOMATIC_BACKUP_LABELS,
} from './Components/AutomaticBackupDialog';
import { showToast } from '@utils/showToast';
import { NOVEL_STORAGE_DIRECTORY_NAME_KEY } from '@utils/Storages';
import { useMMKVObject, useMMKVString } from 'react-native-mmkv';

const DataStorageSettings = ({
  navigation,
}: DataStorageSettingsScreenProps) => {
  const theme = useTheme();
  const {
    automaticBackupIntervalHours = 0,
    automaticBackupDirectoryName,
    automaticBackupDirectoryUri,
    lastAutomaticBackupAt,
    setAppSettings,
  } = useAppSettings();
  const [storageDirectoryName] = useMMKVString(
    NOVEL_STORAGE_DIRECTORY_NAME_KEY,
  );
  const [taskQueue] = useMMKVObject<BackgroundTaskRecord[]>(
    BACKGROUND_TASKS_STORE_KEY,
  );
  const storageMigration = taskQueue?.find(
    task => task.task.name === 'MIGRATE_DOWNLOAD_STORAGE',
  );
  const [backupOptions, setBackupOptions] = useState<BackupOptions>({
    ...DEFAULT_BACKUP_OPTIONS,
  });
  const [pendingStorageDirectory, setPendingStorageDirectory] = useState<
    Awaited<ReturnType<typeof NativeFile.pickDirectory>> | undefined
  >();
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

  const selectStorageDirectory = async () => {
    if (storageMigration) return;
    if (backgroundTasks.isRunning) {
      showToast(getString('dataStorageScreen.storageMigrationTasksBusy'));
      return;
    }

    let directory: Awaited<ReturnType<typeof NativeFile.pickDirectory>>;
    try {
      directory = await NativeFile.pickDirectory();
    } catch {
      return;
    }

    setPendingStorageDirectory(directory);
  };

  const moveDownloads = () => {
    if (!pendingStorageDirectory) return;

    backgroundTasks.enqueue({
      name: 'MIGRATE_DOWNLOAD_STORAGE',
      data: {
        directoryName: pendingStorageDirectory.name,
        directoryUri: pendingStorageDirectory.uri,
      },
    });
  };

  const selectAutomaticBackupDirectory = async () => {
    let directory: Awaited<ReturnType<typeof NativeFile.pickDirectory>>;
    try {
      directory = await NativeFile.pickDirectory();
    } catch {
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
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('dataStorageScreen.title')}
        handleGoBack={() => navigation.goBack()}
        theme={theme}
      />
      <ScrollView style={styles.paddingBottom}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('dataStorageScreen.storage')}
          </List.SubHeader>
          <List.Item
            title={getString('dataStorageScreen.storageLocation')}
            description={
              storageMigration?.meta.progressText ??
              storageDirectoryName ??
              getString('dataStorageScreen.appPrivateStorage')
            }
            onPress={selectStorageDirectory}
            disabled={Boolean(storageMigration)}
            theme={theme}
          />
          <List.InfoItem
            title={getString('dataStorageScreen.storageLocationDescription')}
            theme={theme}
          />
          <List.SubHeader theme={theme}>
            {getString('dataStorageScreen.backupAndRestore')}
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
              storageDirectoryName ??
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
          <List.InfoItem
            title={getString('dataStorageScreen.backupSafetyWarning')}
            theme={theme}
          />
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
      <BackupOptionsDialog
        onCancel={closeBackupOptions}
        onChange={setBackupOptions}
        onConfirm={chooseLocalBackupDestination}
        options={backupOptions}
        theme={theme}
        visible={backupOptionsVisible}
      />
      <ConfirmationDialog
        title={getString('dataStorageScreen.moveDownloadsTitle')}
        message={
          pendingStorageDirectory
            ? getString('dataStorageScreen.moveDownloadsDescription', {
                directory: pendingStorageDirectory.name,
              })
            : undefined
        }
        confirmLabel={getString('dataStorageScreen.moveDownloads')}
        confirmTone="primary"
        visible={Boolean(pendingStorageDirectory)}
        onConfirm={moveDownloads}
        onDismiss={() => setPendingStorageDirectory(undefined)}
      />
      <Portal>
        <AutomaticBackupDialog
          intervalHours={automaticBackupIntervalHours}
          visible={automaticBackupDialog.value}
          onCancel={automaticBackupDialog.setFalse}
          onSelect={setAutomaticBackupInterval}
        />
      </Portal>
    </SafeAreaView>
  );
};

export default DataStorageSettings;

const styles = StyleSheet.create({
  paddingBottom: { paddingBottom: 40 },
});
