import { useState } from 'react';
import { Box, LazyRow } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  width,
} from '@expo/ui/jetpack-compose/modifiers';

import { AppText } from '@components';
import { NovelCoverCard } from '@components/NovelCover';
import { GLOBAL_SEARCH_COVER_WIDTH } from '@components/NovelCoverLayoutContext';
import { showToast } from '@utils/showToast';
import { getString } from '@i18n/translations';
import { MigrateNovelScreenProps } from '@navigators/types';
import { NovelInfo } from '@database/types';
import { ThemeColors } from '@theme/types';
import { getPlugin } from '@plugins/pluginManager';
import { SourceSearchResult } from './MigrationNovels';
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
}: MigrationNovelListProps) => {
  const pluginId = data.id;
  const imageRequestInit = getPlugin(pluginId)?.imageRequestInit;
  const [selectedNovel, setSelectedNovel] = useState<SelectedNovel>();
  const [migrationOptions, setMigrationOptions] =
    useState<MigrationNovelOptions>(DEFAULT_MIGRATION_OPTIONS);

  const inLibrary = (path: string) =>
    library.some(obj => obj.pluginId === pluginId && obj.path === path);

  const showModal = (path: string, name: string) => {
    if (inLibrary(path)) {
      showToast(getString('browseScreen.migration.novelAlreadyInLibrary'));
    } else {
      setMigrationOptions(DEFAULT_MIGRATION_OPTIONS);
      setSelectedNovel({ path, name });
    }
  };

  const hideMigrateNovelDialog = () => setSelectedNovel(undefined);

  const migrateSelectedNovel = () => {
    if (!selectedNovel) return;

    backgroundTasks.enqueue({
      name: 'MIGRATE_NOVEL',
      data: {
        pluginId,
        fromNovel,
        toNovelPath: selectedNovel.path,
        options: migrationOptions,
      },
    });
    hideMigrateNovelDialog();
  };

  return (
    <>
      {data.novels.length ? (
        <LazyRow
          horizontalArrangement={{ spacedBy: 12 }}
          contentPadding={{ start: 16, end: 16 }}
          modifiers={[fillMaxWidth()]}
        >
          {data.novels.map((item, index) => (
            <Box
              key={index + item.path}
              modifiers={[width(GLOBAL_SEARCH_COVER_WIDTH)]}
            >
              <NovelCoverCard
                title={item.name}
                coverUri={item.cover}
                requestInit={imageRequestInit}
                width={GLOBAL_SEARCH_COVER_WIDTH}
                badges={{ inLibrary: inLibrary(item.path) }}
                onPress={() => showModal(item.path, item.name)}
                onLongPress={() =>
                  navigation.push('ReaderStack', {
                    screen: 'Novel',
                    params: { pluginId: pluginId, ...item },
                  })
                }
                theme={theme}
              />
            </Box>
          ))}
        </LazyRow>
      ) : (
        <AppText
          variant="bodyMedium"
          color={theme.onSurfaceVariant}
          modifiers={[padding(16, 4, 16, 8)]}
        >
          {getString('sourceScreen.noResultsFound')}
        </AppText>
      )}
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
