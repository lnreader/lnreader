import { useCallback, useEffect, useState } from 'react';
import { ThemeColors } from '@theme/types';
import { ActivityIndicator, StyleSheet, Text, View, Image } from 'react-native';
import { TextInput } from 'react-native-paper';
import {
  GoogleSignin,
  User,
  isCancelledResponse,
  isErrorWithCode,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { Button, Dialog, EmptyView } from '@components';
import { FlatList, TouchableOpacity } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { DRIVE_ROOT_FOLDER_NAME, getBackups, makeDir } from '@api/drive';
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

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

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
        style={[styles.btnOutline, { borderColor: theme.outline }]}
        onPress={() => setBackupModal(BackupModal.CREATE_BACKUP)}
      />
      <Button
        title={getString('common.restore')}
        style={[styles.btnOutline, { borderColor: theme.outline }]}
        onPress={() => setBackupModal(BackupModal.RESTORE_BACKUP)}
      />
      <Button
        title={getString('common.signOut')}
        style={[styles.btnOutline, { borderColor: theme.outline }]}
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
  const signIn = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      let response = await GoogleSignin.signIn();
      if (isCancelledResponse(response)) {
        return;
      }
      // Google's consent screen lets the user untick Drive access while still
      // signing in; every Drive call would then fail with 403.
      if (!response.data.scopes.includes(DRIVE_SCOPE)) {
        const granted = await GoogleSignin.addScopes({ scopes: [DRIVE_SCOPE] });
        if (!granted || isCancelledResponse(granted)) {
          await GoogleSignin.signOut();
          showToast(getString('backupScreen.drive.permissionRequired'));
          return;
        }
        response = granted;
      }
      setUser(response.data);
      setBackupModal(BackupModal.AUTHORIZED);
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        (error.code === statusCodes.SIGN_IN_CANCELLED ||
          error.code === statusCodes.IN_PROGRESS)
      ) {
        return;
      }
      const message = isErrorWithCode(error)
        ? `${error.message} (${error.code})`
        : getErrorMessage(error);
      showToast(
        getString('backupScreen.drive.signInFailed', { error: message }),
      );
    }
  };
  return (
    <Button
      title={getString('common.signIn')}
      style={[styles.btnOutline, { borderColor: theme.outline }]}
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
    try {
      const rootFolder = await makeDir(DRIVE_ROOT_FOLDER_NAME);
      return await makeDir(backupName.trim() + '.backup', rootFolder.id);
    } finally {
      setFetching(false);
    }
  };
  return (
    <>
      <TextInput
        value={backupName}
        placeholder={getString('backupScreen.backupName')}
        onChangeText={setBackupName}
        mode="outlined"
        underlineColor={theme.outline}
        theme={{ colors: { ...theme } }}
        placeholderTextColor={theme.onSurfaceDisabled}
        disabled={fetching}
      />
      <BackupOptionsList
        onChange={setOptions}
        options={options}
        theme={theme}
      />
      <View style={styles.footerContainer}>
        <Button
          disabled={
            backupName.trim().length === 0 ||
            fetching ||
            !hasSelectedBackupOption(options)
          }
          title={getString('common.ok')}
          onPress={() => {
            prepare()
              .then(folder => {
                closeModal();
                backgroundTasks.enqueue({
                  name: 'DRIVE_BACKUP',
                  data: {
                    backupFolder: folder,
                    options,
                  },
                });
              })
              .catch(error =>
                showToast(
                  getString('backupScreen.drive.prepareFailed', {
                    error: getErrorMessage(error),
                  }),
                ),
              );
          }}
        />
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.AUTHORIZED)}
        />
      </View>
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
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const { dateFormat = 'default', relativeTimestamps = true } =
    useAppSettings();
  useEffect(() => {
    let cancelled = false;
    getBackups()
      .then(backups => {
        if (!cancelled) {
          setBackupList(backups);
        }
      })
      .catch(error => {
        if (!cancelled) {
          setLoadError(
            getString('backupScreen.drive.loadBackupsFailed', {
              error: getErrorMessage(error),
            }),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const emptyComponent = useCallback(() => {
    if (loading) {
      return (
        <ActivityIndicator
          style={styles.loading}
          size="large"
          color={theme.primary}
        />
      );
    }
    return (
      <EmptyView
        description={loadError ?? getString('backupScreen.noBackupFound')}
        theme={theme}
      />
    );
  }, [theme, loading, loadError]);

  return (
    <>
      <Dialog.ScrollArea>
        <FlatList
          contentContainerStyle={styles.backupList}
          data={backupList}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Button
              mode="outlined"
              style={styles.btnOutline}
              onPress={() => {
                closeModal();
                backgroundTasks.enqueue({
                  name: 'DRIVE_RESTORE',
                  data: item,
                });
              }}
            >
              <Text style={{ color: theme.primary }}>
                {item.name?.replace(/\.backup$/, ' ')}
              </Text>
              <Text style={[{ color: theme.secondary }, styles.fontSize]}>
                {'(' +
                  formatDate(item.createdTime, dateFormat, relativeTimestamps) +
                  ')'}
              </Text>
            </Button>
          )}
          ListEmptyComponent={emptyComponent}
        />
      </Dialog.ScrollArea>
      <View style={styles.footerContainer}>
        <Button
          title={getString('common.cancel')}
          onPress={() => setBackupModal(BackupModal.AUTHORIZED)}
        />
      </View>
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
    const isSignedIn = GoogleSignin.hasPreviousSignIn();
    if (isSignedIn) {
      const localUser = GoogleSignin.getCurrentUser();
      if (localUser?.scopes.includes(DRIVE_SCOPE)) {
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
      <Dialog.Header style={styles.titleContainer}>
        <Dialog.Title>
          {getString('backupScreen.drive.googleDriveBackup')}
        </Dialog.Title>
        <TouchableOpacity
          onLongPress={() => {
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
          }}
        >
          {user ? (
            <Image
              source={{ uri: user?.user.photo || '' }}
              style={styles.avatar}
            />
          ) : null}
        </TouchableOpacity>
      </Dialog.Header>
      <Dialog.Content>{renderModal()}</Dialog.Content>
    </Dialog.Root>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderRadius: 40,
    height: 40,
    width: 40,
  },
  backupList: {
    flexGrow: 1,
    paddingBottom: 8,
    paddingHorizontal: 4,
  },
  btnOutline: {
    borderWidth: 1,
    marginVertical: 4,
  },
  error: {
    fontSize: 16,
    marginTop: 8,
  },
  footerContainer: {
    flexDirection: 'row-reverse',
    marginTop: 24,
  },
  loading: {
    marginVertical: 24,
  },
  loadingContent: {
    borderRadius: 16,
    width: '100%',
  },
  titleContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    textAlignVertical: 'center',
  },
  fontSize: { fontSize: 12 },
});
