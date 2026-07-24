import React, { useState } from 'react';
import { TextInput } from 'react-native-paper';

import { Dialog } from '@components/index';

import { Repository } from '@database/types';
import { useTheme } from '@hooks/persisted';

import { getString } from '@i18n/translations';

interface AddRepositoryModalProps {
  repository?: Repository;
  visible: boolean;
  closeModal: () => void;
  upsertRepository: (repositoryUrl: string, repository?: Repository) => void;
}

const AddRepositoryModal: React.FC<AddRepositoryModalProps> = ({
  repository,
  closeModal,
  visible,
  upsertRepository,
}) => {
  const theme = useTheme();
  const [repositoryUrl, setRepositoryUrl] = useState(repository?.url || '');

  return (
    <Dialog.Root visible={visible} onDismiss={closeModal}>
      <Dialog.Title>
        {repository ? 'Edit repository' : 'Add repository'}
      </Dialog.Title>
      <Dialog.Content>
        <TextInput
          autoFocus
          defaultValue={repositoryUrl}
          placeholder={'Repo URL'}
          onChangeText={setRepositoryUrl}
          mode="outlined"
          underlineColor={theme.outline}
          theme={{ colors: { ...theme } }}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action onPress={closeModal}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action
          onPress={() => {
            upsertRepository(repositoryUrl, repository);
            closeModal();
          }}
        >
          {getString(repository ? 'common.ok' : 'common.add')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default AddRepositoryModal;
