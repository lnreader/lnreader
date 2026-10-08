import { list } from '@api/remote';
import { Row } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';
import { AppText, Button, Dialog, EmptyView, TextInput } from '@components';
import { useSelfHost } from '@hooks/persisted/useSelfHost';
import { backgroundTasks } from '@services/backgroundTasks';
import { getString } from '@i18n/translations';
import { ThemeColors } from '@theme/types';
import { fetchTimeout } from '@utils/fetch/fetch';
import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_BACKUP_OPTIONS,
  hasSelectedBackupOption,
  type BackupOptions,
} from '@services/backup/options';
import { BackupOptionsList } from './BackupOptions';

enum BackupModal {
  SET_HOST,
  CONNECTED,
  CREATE_BACKUP,
  RESTORE_BACKUP,
}

interface SelfHostModalProps {
  visible: boolean;
  theme: ThemeColors;
  closeModal: () => void;
}

function CreateBackup({
  host,
  theme,
  setBackupModal,
  closeModal,
}: {
  host: string;
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
}) {
  const [backupName, setBackupName] = useState('');
  const [options, setOptions] = useState<BackupOptions>({
    ...DEFAULT_BACKUP_OPTIONS,
  });

  return (
    <>
      <TextInput
        value={backupName}
        placeholder={getString('backupScreen.backupName')}
        onChangeText={setBackupName}
        singleLine
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
          onPress={() => setBackupModal(BackupModal.CONNECTED)}
        />
        <Button
          disabled={
            backupName.trim().length === 0 || !hasSelectedBackupOption(options)
          }
          title={getString('common.ok')}
          onPress={() => {
            closeModal();
            backgroundTasks.enqueue({
              name: 'SELF_HOST_BACKUP',
              data: {
                host,
                backupFolder: backupName + '.backup',
                options,
              },
            });
          }}
        />
      </Row>
    </>
  );
}

function RestoreBackup({
  host,
  theme,
  setBackupModal,
  closeModal,
}: {
  host: string;
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
  closeModal: () => void;
}) {
  const [backupList, setBackupList] = useState<string[]>([]);
  useEffect(() => {
    list(host).then(items =>
      setBackupList(items.filter(item => item.endsWith('.backup'))),
    );
  }, [host]);

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
          ? backupList.map((item, index) => (
              <Button
                key={item + '_' + index}
                mode="outlined"
                modifiers={[fillMaxWidth()]}
                title={item.replace(/\.backup$/, ' ')}
                onPress={() => {
                  closeModal();
                  backgroundTasks.enqueue({
                    name: 'SELF_HOST_RESTORE',
                    data: {
                      host,
                      backupFolder: item,
                    },
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
          onPress={() => setBackupModal(BackupModal.CONNECTED)}
        />
      </Row>
    </>
  );
}

function SetHost({
  host,
  setHost,
  theme,
  setBackupModal,
}: {
  host: string;
  setHost: (
    value:
      | string
      | ((current: string | undefined) => string | undefined)
      | undefined,
  ) => void;
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
}) {
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  return (
    <>
      <TextInput
        value={host}
        placeholder={getString('backupScreen.remote.host')}
        onChangeText={setHost}
        singleLine
        disabled={fetching}
      />
      {error ? (
        <AppText
          variant="bodyLarge"
          color={theme.error}
          modifiers={[padding(0, 8, 0, 0)]}
        >
          {error}
        </AppText>
      ) : null}
      <Row
        horizontalArrangement="end"
        modifiers={[fillMaxWidth(), padding(0, 24, 0, 0)]}
      >
        <Button
          disabled={host.trim().length === 0 || fetching}
          title={getString('common.ok')}
          onPress={() => {
            setError('');
            setFetching(true);
            fetchTimeout(host, {}, 2000)
              .then(res => res.json())
              .then(data => {
                if (data.name === 'LNReader') {
                  setBackupModal(BackupModal.CONNECTED);
                } else {
                  throw new Error(getString('backupScreen.remote.unknownHost'));
                }
              })
              .catch((e: any) => {
                setError(e.message);
              })
              .finally(() => {
                setFetching(false);
              });
          }}
        />
      </Row>
    </>
  );
}

function Connected({
  theme,
  setBackupModal,
}: {
  theme: ThemeColors;
  setBackupModal: (backupModal: BackupModal) => void;
}) {
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
        title={getString('common.cancel')}
        mode="outlined"
        modifiers={[fillMaxWidth()]}
        onPress={() => setBackupModal(BackupModal.SET_HOST)}
      />
    </>
  );
}

export default function SelfHostModal({
  visible,
  theme,
  closeModal,
}: SelfHostModalProps) {
  const [backupModal, setBackupModal] = useState(BackupModal.SET_HOST);
  const { host, setHost } = useSelfHost();

  const renderModal = () => {
    switch (backupModal) {
      case BackupModal.SET_HOST:
        return (
          <SetHost
            host={host}
            setHost={setHost}
            theme={theme}
            setBackupModal={setBackupModal}
          />
        );
      case BackupModal.CONNECTED:
        return <Connected theme={theme} setBackupModal={setBackupModal} />;
      case BackupModal.CREATE_BACKUP:
        return (
          <CreateBackup
            host={host}
            closeModal={closeModal}
            setBackupModal={setBackupModal}
            theme={theme}
          />
        );
      case BackupModal.RESTORE_BACKUP:
        return (
          <RestoreBackup
            host={host}
            closeModal={closeModal}
            setBackupModal={setBackupModal}
            theme={theme}
          />
        );
    }
  };

  return (
    <Dialog.Root visible={visible} onDismiss={closeModal}>
      <Dialog.Title>{getString('backupScreen.remote.backup')}</Dialog.Title>
      <Dialog.Content>{renderModal()}</Dialog.Content>
    </Dialog.Root>
  );
}
