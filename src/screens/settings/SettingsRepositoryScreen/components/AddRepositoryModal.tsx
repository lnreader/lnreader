import React, { useState } from 'react';

import { Dialog, TextInput } from '@components/index';

import { Repository } from '@database/types';

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
  const [repositoryUrl, setRepositoryUrl] = useState(repository?.url || '');

  return (
    <Dialog.Root visible={visible} onDismiss={closeModal}>
      <Dialog.Title>
        {repository ? 'Edit repository' : 'Add repository'}
      </Dialog.Title>
      <Dialog.Content>
        <TextInput
          autoFocus
          value={repositoryUrl}
          placeholder={'Repo URL'}
          onChangeText={setRepositoryUrl}
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
