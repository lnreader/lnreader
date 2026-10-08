import { FC } from 'react';
import { Card, Row } from '@expo/ui/jetpack-compose';
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import {
  AppIcon,
  AppText,
  ConfirmationDialog,
  IconButtonV2,
} from '@components';
import Switch from '@components/Switch/Switch';

import { Repository } from '@database/types';
import { useBoolean } from '@hooks/index';
import { useTheme } from '@hooks/persisted';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import AddRepositoryModal from './AddRepositoryModal';
import DeleteRepositoryModal from './DeleteRepositoryModal';
import ContentCopyIcon from '@expo/material-symbols/content_copy.xml';
import DeleteIcon from '@expo/material-symbols/delete.xml';
import LabelIcon from '@expo/material-symbols/label.xml';
import OpenInNewIcon from '@expo/material-symbols/open_in_new.xml';

interface RepositoryCardProps {
  repository: Repository;
  refetchRepositories: () => void;
  toggleRepository: (repository: Repository) => void | Promise<void>;
  upsertRepository: (repositoryUrl: string, repository?: Repository) => void;
}

const RepositoryCard: FC<RepositoryCardProps> = ({
  repository,
  refetchRepositories,
  toggleRepository,
  upsertRepository,
}) => {
  const theme = useTheme();
  const repositoryName = `${repository.url.split('/')?.[3]}/${
    repository.url.split('/')?.[4]
  }`;

  const {
    value: repositoryModalVisible,
    setTrue: showRepositoryModal,
    setFalse: closeRepositoryModal,
  } = useBoolean();

  const {
    value: deleteRepositoryModalVisible,
    setTrue: showDeleteRepositoryModal,
    setFalse: closeDeleteRepositoryModal,
  } = useBoolean();

  const {
    value: disableRepositoryModalVisible,
    setTrue: showDisableRepositoryModal,
    setFalse: closeDisableRepositoryModal,
  } = useBoolean();

  const onToggleRepository = () => {
    if (repository.enabled) {
      showDisableRepositoryModal();
    } else {
      toggleRepository(repository);
    }
  };

  return (
    <Card
      colors={{
        containerColor: theme.surfaceContainerHigh,
        contentColor: theme.onSurface,
      }}
      modifiers={[fillMaxWidth(), padding(16, 4, 16, 4)]}
    >
      <Row
        verticalAlignment="center"
        modifiers={[fillMaxWidth(), padding(0, 4, 16, 0)]}
      >
        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[
            weight(1),
            clickable(showRepositoryModal),
            padding(16, 12, 8, 12),
          ]}
        >
          <AppIcon source={LabelIcon} tint={theme.onSurface} />
          <AppText variant="bodyLarge" maxLines={1} modifiers={[weight(1)]}>
            {repositoryName}
          </AppText>
        </Row>
        <Switch
          // Live query rows are raw: SQLite booleans arrive as 0 / 1.
          value={Boolean(repository.enabled)}
          onValueChange={onToggleRepository}
        />
      </Row>
      <Row modifiers={[fillMaxWidth(), padding(4, 0, 4, 4)]}>
        <IconButtonV2
          name={OpenInNewIcon}
          color={theme.onSurface}
          onPress={() => Linking.openURL(repository.url)}
          theme={theme}
        />
        <IconButtonV2
          name={ContentCopyIcon}
          color={theme.onSurface}
          onPress={() =>
            Clipboard.setStringAsync(repository.url).then(() => {
              showToast(getString('common.copiedToClipboard', { name: '' }));
            })
          }
          theme={theme}
        />
        <IconButtonV2
          name={DeleteIcon}
          color={theme.onSurface}
          onPress={showDeleteRepositoryModal}
          theme={theme}
        />
      </Row>
      <AddRepositoryModal
        repository={repository}
        visible={repositoryModalVisible}
        closeModal={closeRepositoryModal}
        upsertRepository={upsertRepository}
      />
      <DeleteRepositoryModal
        repository={repository}
        visible={deleteRepositoryModalVisible}
        closeModal={closeDeleteRepositoryModal}
        onSuccess={refetchRepositories}
      />
      <ConfirmationDialog
        confirmFirst
        confirmLabel={getString('repositories.disable')}
        message={getString('repositories.disableWarning', {
          name: repositoryName,
        })}
        title={getString('repositories.disableTitle')}
        visible={disableRepositoryModalVisible}
        onConfirm={() => toggleRepository(repository)}
        onDismiss={closeDisableRepositoryModal}
      />
    </Card>
  );
};

export default RepositoryCard;
