import { useCallback, useEffect, useState } from 'react';
import { ThemeColors } from '@theme/types';
import { Column, Image, Row } from '@expo/ui/jetpack-compose';
import {
  clip,
  combinedClickable,
  fillMaxWidth,
  padding,
  Shapes,
  size,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { GoogleSignin, User } from '@react-native-google-signin/google-signin';
import { Button, Dialog, EmptyView, TextInput } from '@components';
import * as Clipboard from 'expo-clipboard';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { exists, getBackups, makeDir } from '@api/drive';
import { DriveFile } from '@api/drive/types';
import { backgroundTasks } from '@services/backgroundTasks';
import { useAppSettings } from '@hooks/persisted';
import { formatDate } from '@utils/dateFormat';
import {
  DEFAULT_BACKUP_OPTIONS,
  hasSelectedBackupOption,
  type BackupOptions,
} from '@services/backup/options';
import { BackupOptionsList } from './BackupOptions';

enum BackupModal {
  UNAUTHORIZED,
  AUTHORIZED,
  CREATE_BACKUP,
  RESTORE_BACKUP,
}

function Authorized({
  theme,
  setBackupModal,
  setUser,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  setUser: (user?: User) => void;
}) {
  const signOut = () => {
    GoogleSignin.signOut().then(() => {
      setUser();
      setBackupModal(BackupModal.UNAUTHORIZED);
    });
  };
  return (
    <>
      <Button
        title={getString('common.backup')}
        mode="outlined"
        modifiers={[fillMaxWidth()]}
        onPress={() => setBackupModal(BackupModal.CREATE_BACKUP)}
      />
      <Button
        title={getString('common.restore')}
        mode="outlined"
        modifiers={[fillMaxWidth()]}
        onPress={() => setBackupModal(BackupModal.RESTORE_BACKUP)}
      />
      <Button
        title={getString('common.signOut')}
        mode="outlined"
        modifiers={[fillMaxWidth()]}
        onPress={signOut}
      />
    </>
  );
}

function UnAuthorized({
  theme,
  setBackupModal,
  setUser,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  setUser: (user?: User | null) => void;
}) {
  const signIn = () => {
    GoogleSignin.hasPlayServices()
      .then(hasPlayServices => {
        if (hasPlayServices) {
          return GoogleSignin.signIn();
        }
      })
      .then(response => {
        setUser(response?.data);
        setBackupModal(BackupModal.AUTHORIZED);
      });
  };
  return (
    <Button
      title={getString('common.signIn')}
      mode="outlined"
      modifiers={[fillMaxWidth()]}
      onPress={signIn}
    />
  );
}

function CreateBackup({
  theme,
  setBackupModal,
  closeModal,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
}) {
  const [backupName, setBackupName] = useState('');
  const [fetching, setFetching] = useState(false);
  const [options, setOptions] = useState<BackupOptions>({
    ...DEFAULT_BACKUP_OPTIONS,
  });

  const prepare = async () => {
    setFetching(true);
    let rootFolder = await exists('LNReader', true, undefined, true);
    if (!rootFolder) {
      rootFolder = await makeDir('LNReader');
    }
    const backupFolderName = backupName.trim() + '.backup';
    let backupFolder = await exists(backupFolderName, true, rootFolder.id);
    if (!backupFolder) {
      backupFolder = await makeDir(backupFolderName, rootFolder.id);
    }
    setFetching(false);
    return backupFolder;
  };

  return (
    <>
      <TextInput
        value={backupName}
        placeholder={getString('backupScreen.backupName')}
        onChangeText={setBackupName}
        singleLine
        disabled={fetching}
      />
      <BackupOptionsList
        onChange={setOptions}
        options={options}
        theme={theme}
      />
      <Row
        horizontalArrangement="end"
        modifiers={[fillMaxWidth(), padding(0, 24, 0, 0)]}
      >
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.AUTHORIZED)}
        />
        <Button
          disabled={
            backupName.trim().length === 0 ||
            fetching ||
            !hasSelectedBackupOption(options)
          }
          title={getString('common.ok')}
          onPress={() => {
            prepare().then(folder => {
              closeModal();
              backgroundTasks.enqueue({
                name: 'DRIVE_BACKUP',
                data: {
                  backupFolder: folder,
                  options,
                },
              });
            });
          }}
        />
      </Row>
    </>
  );
}

function RestoreBackup({
  theme,
  setBackupModal,
  closeModal,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
}) {
  const [backupList, setBackupList] = useState<DriveFile[]>([]);
  const { dateFormat = 'default', relativeTimestamps = true } =
    useAppSettings();
  useEffect(() => {
    exists('LNReader', true, undefined, true).then(rootFolder => {
      if (rootFolder) {
        getBackups(rootFolder.id, true).then(backups => setBackupList(backups));
      }
    });
  }, []);

  const emptyComponent = useCallback(() => {
    return (
      <EmptyView
        description={getString('backupScreen.noBackupFound')}
        theme={theme}
      />
    );
  }, [theme]);

  return (
    <>
      <Dialog.ScrollArea fixed>
        {backupList.length
          ? backupList.map(item => (
              <Button
                key={item.id}
                mode="outlined"
                modifiers={[fillMaxWidth()]}
                title={`${item.name?.replace(/\.backup$/, ' ')} (${formatDate(
                  item.createdTime,
                  dateFormat,
                  relativeTimestamps,
                )})`}
                onPress={() => {
                  closeModal();
                  backgroundTasks.enqueue({
                    name: 'DRIVE_RESTORE',
                    data: item,
                  });
                }}
              />
            ))
          : emptyComponent()}
      </Dialog.ScrollArea>
      <Row
        horizontalArrangement="end"
        modifiers={[fillMaxWidth(), padding(0, 24, 0, 0)]}
      >
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.AUTHORIZED)}
        />
      </Row>
    </>
  );
}

interface GoogleDriveModalProps {
  visible: boolean;
  theme: ThemeColors;
  closeModal: () => void;
}

export default function GoogleDriveModal({
  visible,
  theme,
  closeModal,
}: GoogleDriveModalProps) {
  const [backupModal, setBackupModal] = useState(BackupModal.UNAUTHORIZED);
  const [user, setUser] = useState<User | null | undefined>(null);
  useEffect(() => {
    GoogleSignin.configure({
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    const isSignedIn = GoogleSignin.hasPreviousSignIn();
    if (isSignedIn) {
      const localUser = GoogleSignin.getCurrentUser();
      if (localUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(localUser);
        setBackupModal(BackupModal.AUTHORIZED);
      }
    } else {
      setBackupModal(BackupModal.UNAUTHORIZED);
    }
  }, []);

  const renderModal = () => {
    switch (backupModal) {
      case BackupModal.AUTHORIZED:
        return (
          <Authorized
            theme={theme}
            setBackupModal={setBackupModal}
            setUser={setUser}
          />
        );
      case BackupModal.UNAUTHORIZED:
        return (
          <UnAuthorized
            theme={theme}
            setBackupModal={setBackupModal}
            setUser={setUser}
          />
        );
      case BackupModal.CREATE_BACKUP:
        return (
          <CreateBackup
            theme={theme}
            setBackupModal={setBackupModal}
            closeModal={closeModal}
          />
        );
      case BackupModal.RESTORE_BACKUP:
        return (
          <RestoreBackup
            theme={theme}
            setBackupModal={setBackupModal}
            closeModal={closeModal}
          />
        );
    }
  };

  return (
    <Dialog.Root visible={visible} onDismiss={closeModal}>
      <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
        <Column modifiers={[weight(1)]}>
          <Dialog.Title>
            {getString('backupScreen.drive.googleDriveBackup')}
          </Dialog.Title>
        </Column>
        {user ? (
          <Image
            source={{ uri: user?.user.photo || '' }}
            modifiers={[
              padding(0, 0, 24, 0),
              size(40, 40),
              clip(Shapes.Circle),
              combinedClickable({
                onClick: () => undefined,
                onLongClick: () => {
                  if (user?.user.email) {
                    Clipboard.setStringAsync(user.user.email).then(success => {
                      if (success) {
                        showToast(
                          getString('common.copiedToClipboard', {
                            name: user.user.email,
                          }),
                        );
                      }
                    });
                  }
                },
              }),
            ]}
          />
        ) : null}
      </Row>
      <Dialog.Content>{renderModal()}</Dialog.Content>
    </Dialog.Root>
  );
}
