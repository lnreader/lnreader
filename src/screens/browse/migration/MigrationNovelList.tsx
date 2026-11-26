import { useState } from 'react';
import { StyleSheet, FlatList, Text, FlatListProps } from 'react-native';
import GlobalSearchNovelCover from '../globalsearch/GlobalSearchNovelCover';

import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { MigrateNovelScreenProps } from '@navigators/types';
import { NovelInfo } from '@database/types';
import { ThemeColors } from '@theme/types';
import { SourceSearchResult } from './MigrationNovels';
import type { MigrationTarget } from '@services/migrate/verifyMigration';
import { NovelItem } from '@plugins/types';
import {
  backgroundTasks,
  type MigrationNovelOptions,
} from '@services/backgroundTasks';
import MigrationReviewDialog from './MigrationReviewDialog';

interface MigrationNovelListProps {
  data: SourceSearchResult;
  fromNovel: NovelInfo;
  theme: ThemeColors;
  library: NovelInfo[];
  navigation: MigrateNovelScreenProps['navigation'];
  isMigrating: boolean;
  onMigrationQueued: (target: MigrationTarget) => void;
  onMigrationAborted: (target: MigrationTarget) => void;
  onMigrationEnqueued: (target: MigrationTarget) => void;
  onMigrationBlocked: () => void;
}

interface SelectedNovel {
  path: string;
  name: string;
}

const DEFAULT_MIGRATION_OPTIONS: MigrationNovelOptions = {
  cover: 'destination',
  metadata: 'destination',
  redownloadChapters: true,
};

const MigrationNovelList = ({
  data,
  fromNovel,
  theme,
  library,
  navigation,
  isMigrating,
  onMigrationQueued,
  onMigrationAborted,
  onMigrationEnqueued,
  onMigrationBlocked,
}: MigrationNovelListProps) => {
  const pluginId = data.id;
  const [selectedNovel, setSelectedNovel] = useState<SelectedNovel>();
  const [migrationOptions, setMigrationOptions] =
    useState<MigrationNovelOptions>(DEFAULT_MIGRATION_OPTIONS);

  const inLibrary = (path: string) =>
    library.some(obj => obj.pluginId === pluginId && obj.path === path);

  const renderItem: FlatListProps<NovelItem>['renderItem'] = ({ item }) => (
    <GlobalSearchNovelCover
      novel={item}
      theme={theme}
      onPress={() => showModal(item.path, item.name)}
      onLongPress={() =>
        navigation.push('ReaderStack', {
          screen: 'Novel',
          params: { pluginId: pluginId, ...item },
        })
      }
      inLibrary={inLibrary(item.path)}
    />
  );

  const showModal = (path: string, name: string) => {
    if (isMigrating) {
      onMigrationBlocked();
      return;
    }
    if (inLibrary(path)) {
      showToast(getString('browseScreen.migration.novelAlreadyInLibrary'));
    } else {
      setMigrationOptions(DEFAULT_MIGRATION_OPTIONS);
      setSelectedNovel({ path, name });
    }
  };

  const hideMigrateNovelDialog = () => setSelectedNovel(undefined);

  const migrateSelectedNovel = () => {
    if (!selectedNovel || isMigrating) return;

    const target: MigrationTarget = {
      fromNovelId: fromNovel.id,
      pluginId,
      toNovelPath: selectedNovel.path,
    };
    onMigrationQueued(target);
    backgroundTasks
      .enqueue({
        name: 'MIGRATE_NOVEL',
        data: {
          pluginId,
          fromNovel,
          toNovelPath: selectedNovel.path,
          options: migrationOptions,
        },
      })
      .then(queued => {
        if (queued) {
          onMigrationEnqueued(target);
        } else {
          onMigrationAborted(target);
        }
      });
    hideMigrateNovelDialog();
  };

  return (
    <>
      <FlatList
        contentContainerStyle={styles.flatListCont}
        horizontal={true}
        data={data.novels}
        keyExtractor={(item, index) => index + item.path}
        renderItem={renderItem}
        ListEmptyComponent={
          <Text
            style={[
              {
                color: theme.onSurfaceVariant,
              },
              styles.padding,
            ]}
          >
            {getString('sourceScreen.noResultsFound')}
          </Text>
        }
      />
      <MigrationReviewDialog
        destinationName={selectedNovel?.name ?? ''}
        options={migrationOptions}
        theme={theme}
        visible={selectedNovel !== undefined}
        onCancel={hideMigrateNovelDialog}
        onChange={setMigrationOptions}
        onMigrate={migrateSelectedNovel}
      />
    </>
  );
};

export default MigrationNovelList;

const styles = StyleSheet.create({
  flatListCont: {
    flexGrow: 1,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  padding: { padding: 8, paddingVertical: 4 },
});
