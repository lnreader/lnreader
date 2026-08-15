import { FC } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialCommunityIcons from '@react-native-vector-icons/material-design-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';

import { ConfirmationDialog, IconButtonV2 } from '@components';
import Switch from '@components/Switch/Switch';

import { Repository } from '@database/types';
import { useBoolean } from '@hooks/index';
import { useTheme } from '@hooks/persisted';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { Portal } from 'react-native-paper';
import AddRepositoryModal from './AddRepositoryModal';
import DeleteRepositoryModal from './DeleteRepositoryModal';

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
    <View
      style={[
        styles.cardCtn,
        {
          backgroundColor: theme.secondaryContainer,
        },
      ]}
    >
      <View style={styles.headerCtn}>
        <Pressable
          accessibilityLabel={repositoryName}
          accessibilityRole="button"
          android_ripple={{ color: theme.rippleColor }}
          style={styles.nameCtn}
          onPress={showRepositoryModal}
        >
          <MaterialCommunityIcons
            accessible={false}
            name="label-outline"
            color={theme.onSurface}
            size={24}
          />
          <Text
            ellipsizeMode="middle"
            numberOfLines={1}
            style={[styles.name, { color: theme.onSurface }]}
          >
            {repositoryName}
          </Text>
        </Pressable>
        <Switch
          accessibilityLabel={getString('repositories.toggle', {
            name: repositoryName,
          })}
          containerStyle={styles.switchCtn}
          value={repository.enabled}
          onValueChange={onToggleRepository}
        />
      </View>
      <View style={styles.buttonsCtn}>
        <IconButtonV2
          name="open-in-new"
          color={theme.onSurface}
          onPress={() => Linking.openURL(repository.url)}
          padding={12}
          theme={theme}
        />
        <IconButtonV2
          name="content-copy"
          color={theme.onSurface}
          onPress={() =>
            Clipboard.setStringAsync(repository.url).then(() => {
              showToast(getString('common.copiedToClipboard', { name: '' }));
            })
          }
          padding={12}
          theme={theme}
        />
        <IconButtonV2
          name="delete-outline"
          color={theme.onSurface}
          onPress={showDeleteRepositoryModal}
          padding={12}
          theme={theme}
        />
      </View>
      <Portal>
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
      </Portal>
    </View>
  );
};

export default RepositoryCard;

const styles = StyleSheet.create({
  buttonsCtn: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cardCtn: {
    borderCurve: 'continuous',
    borderRadius: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    marginBottom: 8,
    marginHorizontal: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  headerCtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  name: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
  },
  nameCtn: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
    minWidth: 0,
  },
  switchCtn: {
    justifyContent: 'center',
    minHeight: 48,
  },
});
