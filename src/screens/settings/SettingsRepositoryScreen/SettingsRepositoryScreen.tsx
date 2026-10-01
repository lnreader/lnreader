import { useCallback, useEffect } from 'react';

import {
  Appbar,
  ComposeList,
  EmptyView,
  Fab,
  Screen,
  useScreenInsets,
} from '@components';
import AddIcon from '@expo/material-symbols/add.xml';

import {
  createRepository,
  isRepoUrlDuplicated,
  setRepositoryEnabled,
  updateRepository,
} from '@database/queries/RepositoryQueries';
import { Repository } from '@database/types';
import { useBoolean } from '@hooks/index';
import { usePluginActions, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

import AddRepositoryModal from './components/AddRepositoryModal';
import RepositoryCard from './components/RepositoryCard';
import { RespositorySettingsScreenProps } from '@navigators/types';
import { showToast } from '@utils/showToast';
import { useLiveQuery } from '@database/manager/liveQuery';
import { repositorySchema } from '@database/schema';
import { dbManager } from '@database/db';

const SettingsBrowseScreen = ({
  route: { params },
  navigation,
}: RespositorySettingsScreenProps) => {
  const theme = useTheme();
  const { bottom } = useScreenInsets();
  const { refreshPlugins } = usePluginActions();

  const repositories = useLiveQuery(dbManager.select().from(repositorySchema), [
    { table: 'Repository' },
  ]);

  const {
    value: addRepositoryModalVisible,
    setTrue: showAddRepositoryModal,
    setFalse: closeAddRepositoryModal,
  } = useBoolean();

  const upsertRepository = useCallback(
    async (repositoryUrl: string, repository?: Repository) => {
      if (
        !new RegExp(/https?:\/\/(.*)plugins\.min\.json/).test(repositoryUrl)
      ) {
        showToast('Repository URL is invalid');
        return;
      }

      if (await isRepoUrlDuplicated(repositoryUrl)) {
        showToast('A respository with this url already exists!');
      } else {
        if (repository) {
          await updateRepository(repository.id, repositoryUrl);
        } else {
          await createRepository(repositoryUrl);
        }
        refreshPlugins();
      }
    },
    [refreshPlugins],
  );

  const toggleRepository = useCallback(
    async (repository: Repository) => {
      try {
        await setRepositoryEnabled(repository.id, !repository.enabled);
        await refreshPlugins({
          clearUnavailableUpdates: repository.enabled,
        });
      } catch (error) {
        showToast(error instanceof Error ? error.message : String(error));
      }
    },
    [refreshPlugins],
  );

  const renderRepository = useCallback(
    (item: Repository) => (
      <RepositoryCard
        repository={item}
        refetchRepositories={refreshPlugins}
        toggleRepository={toggleRepository}
        upsertRepository={upsertRepository}
      />
    ),
    [refreshPlugins, toggleRepository, upsertRepository],
  );

  useEffect(() => {
    if (params?.url) {
      upsertRepository(params.url);
    }
  }, [params, upsertRepository]);

  return (
    <Screen
      topBar={
        <Appbar
          title={getString('browseScreen.repositories')}
          handleGoBack={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
          theme={theme}
        />
      }
      list={
        repositories.length ? (
          <ComposeList
            data={repositories}
            contentPadding={{ top: 4, bottom: bottom + 96 }}
            keyExtractor={repository => repository.id.toString()}
            renderItem={renderRepository}
          />
        ) : undefined
      }
      floatingAction={
        <Fab
          extended
          label={getString('common.add')}
          onPress={showAddRepositoryModal}
          icon={AddIcon}
        />
      }
      overlays={
        <AddRepositoryModal
          visible={addRepositoryModalVisible}
          closeModal={closeAddRepositoryModal}
          upsertRepository={upsertRepository}
        />
      }
    >
      {repositories.length ? null : (
        <EmptyView
          icon="Σ(ಠ_ಠ)"
          description={getString('repositories.emptyMsg')}
          theme={theme}
        />
      )}
    </Screen>
  );
};

export default SettingsBrowseScreen;
