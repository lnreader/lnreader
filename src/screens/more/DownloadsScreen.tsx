import { useCallback, useEffect, useMemo, useState } from 'react';

import { Appbar as MaterialAppbar } from 'react-native-paper';

import EmptyView from '@components/EmptyView';
import { Appbar, List, SafeAreaView } from '@components';
import {
  deleteChapter,
  deleteDownloads,
  getDownloadedChapters,
} from '@database/queries/ChapterQueries';

import { useTheme } from '@hooks/persisted';

import RemoveDownloadsDialog from './components/RemoveDownloadsDialog';
import UpdatesSkeletonLoading from '@screens/updates/components/UpdatesSkeletonLoading';
import GroupedChapterList, {
  type ChapterGroup,
  toggleChapterGroup,
} from '@components/GroupedChapterList/GroupedChapterList';
import { getString } from '@i18n/translations';
import { DownloadsScreenProps } from '@navigators/types';
import { DownloadedChapter } from '@database/types';
import { showToast } from '@utils/showToast';

type DownloadGroup = Record<number, DownloadedChapter[]>;

const groupChaptersByNovel = (
  chapters: DownloadedChapter[],
): ChapterGroup[] => {
  const novelGroups = chapters.reduce((groups, chapter) => {
    if (!groups[chapter.novelId]) {
      groups[chapter.novelId] = [];
    }

    groups[chapter.novelId].push(chapter);
    return groups;
  }, {} as DownloadGroup);

  return Object.values(novelGroups).flatMap(group => {
    const chapter = group[0];
    return chapter
      ? [
          {
            key: String(chapter.novelId),
            novel: {
              id: chapter.novelId,
              pluginId: chapter.pluginId,
              name: chapter.novelName,
              path: chapter.novelPath,
              cover: chapter.novelCover,
            },
            count: group.length,
            chapters: group,
          },
        ]
      : [];
  });
};

const Downloads = ({ navigation }: DownloadsScreenProps) => {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<DownloadedChapter[]>([]);

  /**
   * Confirm Clear downloads Dialog
   */
  const [visible, setVisible] = useState(false);
  const showDialog = () => setVisible(true);
  const hideDialog = () => setVisible(false);

  const [expanded, setExpanded] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const sections = useMemo(
    () => [{ key: 'downloads', groups: groupChaptersByNovel(chapters) }],
    [chapters],
  );
  const getChapters = useCallback(async () => {
    setChapters(await getDownloadedChapters());
  }, []);

  const onDeleteChapter = useCallback(
    async (chapter: DownloadedChapter) => {
      try {
        await deleteChapter(chapter.pluginId, chapter.novelId, chapter.id);
        showToast(`${getString('common.delete')} ${chapter.name}`);
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : getString('novelScreen.deleteChapterError'),
        );
      } finally {
        await getChapters();
      }
    },
    [getChapters],
  );

  useEffect(() => {
    const timer = setTimeout(
      () => void getChapters().finally(() => setLoading(false)),
      0,
    );

    return () => clearTimeout(timer);
  }, [getChapters]);

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('common.downloads')}
        handleGoBack={navigation.goBack}
        theme={theme}
      >
        {chapters.length > 0 ? (
          <MaterialAppbar.Action
            icon="delete-sweep"
            iconColor={theme.onSurface}
            onPress={showDialog}
          />
        ) : null}
      </Appbar>

      <List.InfoItem
        title={getString('downloadScreen.storageInfo')}
        theme={theme}
      />
      {loading ? (
        <UpdatesSkeletonLoading theme={theme} />
      ) : (
        <GroupedChapterList
          sections={sections}
          theme={theme}
          expanded={expanded}
          onToggleGroup={key =>
            setExpanded(previous => toggleChapterGroup(previous, key))
          }
          countLabel={getString('downloadScreen.downloadsLower')}
          onDeleteChapter={onDeleteChapter}
          empty={
            <EmptyView
              icon="(˘･_･˘)"
              description={getString('downloadScreen.noDownloads')}
            />
          }
        />
      )}
      <RemoveDownloadsDialog
        dialogVisible={visible}
        hideDialog={hideDialog}
        onSubmit={async () => {
          try {
            await deleteDownloads(chapters);
            setChapters([]);
            setExpanded(new Set());
          } catch (error) {
            showToast(
              error instanceof Error
                ? error.message
                : getString('novelScreen.deleteChapterError'),
            );
            await getChapters();
          } finally {
            hideDialog();
          }
        }}
      />
    </SafeAreaView>
  );
};

export default Downloads;
