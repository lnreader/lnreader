import { useState } from 'react';
import { StyleSheet, FlatList, Text, FlatListProps } from 'react-native';
import GlobalSearchNovelCover from '../globalsearch/GlobalSearchNovelCover';

import { showToast } from '@utils/showToast';
import { Dialog } from '@components';
import { getString } from '@i18n/translations';
import { MigrateNovelScreenProps } from '@navigators/types';
import { NovelInfo } from '@database/types';
import { ThemeColors } from '@theme/types';
import { SourceSearchResult } from './MigrationNovels';
import { NovelItem } from '@plugins/types';
import { backgroundTasks } from '@services/backgroundTasks';

interface MigrationNovelListProps {
  data: SourceSearchResult;
  fromNovel: NovelInfo;
  theme: ThemeColors;
  library: NovelInfo[];
  navigation: MigrateNovelScreenProps['navigation'];
}

interface SelectedNovel {
  path: string;
  name: string;
}

const MigrationNovelList = ({
  data,
  fromNovel,
  theme,
  library,
  navigation,
}: MigrationNovelListProps) => {
  const pluginId = data.id;
  const [selectedNovel, setSelectedNovel] = useState<SelectedNovel>(
    {} as SelectedNovel,
  );
  const [migrateNovelDialog, setMigrateNovelDialog] = useState(false);
  const showMigrateNovelDialog = () => setMigrateNovelDialog(true);
  const hideMigrateNovelDialog = () => setMigrateNovelDialog(false);

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
    if (inLibrary(path)) {
      showToast(getString('browseScreen.migration.novelAlreadyInLibrary'));
    } else {
      setSelectedNovel({ path, name });
      showMigrateNovelDialog();
    }
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
      <Dialog.Root
        visible={migrateNovelDialog}
        onDismiss={hideMigrateNovelDialog}
      >
        <Dialog.Title>{getString('novelScreen.migrate')}</Dialog.Title>
        <Dialog.Description>
          {getString('browseScreen.migration.dialogMessage', {
            url: selectedNovel.name,
          })}
        </Dialog.Description>
        <Dialog.Actions>
          <Dialog.Action
            onPress={hideMigrateNovelDialog}
            title={getString('common.cancel')}
          />
          <Dialog.Action
            onPress={() => {
              hideMigrateNovelDialog();
              backgroundTasks.enqueue({
                name: 'MIGRATE_NOVEL',
                data: {
                  pluginId,
                  fromNovel,
                  toNovelPath: selectedNovel.path,
                },
              });
            }}
            title={getString('novelScreen.migrate')}
          />
        </Dialog.Actions>
      </Dialog.Root>
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
