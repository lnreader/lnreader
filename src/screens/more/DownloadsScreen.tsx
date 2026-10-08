import { useCallback, useEffect, useMemo, useState } from 'react';
import { Box } from '@expo/ui/jetpack-compose';
import { padding } from '@expo/ui/jetpack-compose/modifiers';

import EmptyView from '@components/EmptyView';
import {
  Appbar,
  ComposeList,
  IconButtonV2,
  List,
  Screen,
  useScreenInsets,
} from '@components';
import {
  deleteChapter,
  deleteDownloads,
  getDownloadedChapters,
} from '@database/queries/ChapterQueries';

import { useTheme } from '@hooks/persisted';

import RemoveDownloadsDialog from './components/RemoveDownloadsDialog';
import UpdatesSkeletonLoading from '@screens/updates/components/UpdatesSkeletonLoading';
import DownloadedNovelChapterGroup from './components/DownloadedNovelChapterGroup';
import { getString } from '@i18n/translations';
import { DownloadsScreenProps } from '@navigators/types';
import { DownloadedChapter } from '@database/types';
import { showToast } from '@utils/showToast';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import DeleteSweepIcon from '@expo/material-symbols/delete_sweep.xml';

type DownloadGroup = Record<number, DownloadedChapter[]>;

// Expanded chapters are rows of the list rather than children of their
// group's row, so a novel with hundreds of downloads stays virtualized.
type DownloadRow =
  | { kind: 'group'; chapters: DownloadedChapter[] }
  | { kind: 'chapter'; chapter: DownloadedChapter };

const groupChaptersByNovel = (
  chapters: DownloadedChapter[],
): DownloadedChapter[][] => {
  const novelGroups = chapters.reduce((groups, chapter) => {
    if (!groups[chapter.novelId]) {
      groups[chapter.novelId] = [];
    }

    groups[chapter.novelId].push(chapter);
    return groups;
  }, {} as DownloadGroup);

  return Object.values(novelGroups);
};

const Downloads = ({ navigation }: DownloadsScreenProps) => {
  const theme = useTheme();
  const { bottom } = useScreenInsets();
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<DownloadedChapter[]>([]);
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(new Set());

  const toggleExpanded = useCallback(
    (novelId: number) =>
      setExpanded(current => {
        const next = new Set(current);
        if (!next.delete(novelId)) {
          next.add(novelId);
        }
        return next;
      }),
    [],
  );

  const rows = useMemo(
    () =>
      groupChaptersByNovel(chapters).flatMap((group): DownloadRow[] => {
        const novelId = group[0]?.novelId;
        const groupRow: DownloadRow = { kind: 'group', chapters: group };
        return group.length > 1 && expanded.has(novelId)
          ? [
              groupRow,
              ...group.map(
                (chapter): DownloadRow => ({ kind: 'chapter', chapter }),
              ),
            ]
          : [groupRow];
      }),
    [chapters, expanded],
  );

  /**
   * Confirm Clear downloads Dialog
   */
  const [visible, setVisible] = useState(false);
  const showDialog = () => setVisible(true);
  const hideDialog = () => setVisible(false);

  const getChapters = useCallback(async () => {
    const res = await getDownloadedChapters();
    setChapters(
      res.map(download => {
        return {
          ...download,
          chapterNumber: download.chapterNumber
            ? download.chapterNumber
            : parseChapterNumber(download.novelName, download.name),
        };
      }),
    );
  }, []);

  useEffect(() => {
    const timer = setTimeout(
      () => void getChapters().finally(() => setLoading(false)),
      0,
    );

    return () => clearTimeout(timer);
  }, [getChapters]);

  return (
    <Screen
      topBar={
        <Appbar
          title={getString('common.downloads')}
          handleGoBack={navigation.goBack}
          theme={theme}
        >
          {chapters.length > 0 ? (
            <IconButtonV2
              name={DeleteSweepIcon}
              color={theme.onSurface}
              onPress={showDialog}
              theme={theme}
            />
          ) : null}
        </Appbar>
      }
      list={
        loading ? undefined : (
          <ComposeList
            contentPadding={{ top: 8, bottom: bottom + 8 }}
            data={rows}
            extraData={expanded}
            estimatedItemSize={64}
            keyExtractor={row =>
              row.kind === 'group'
                ? `downloadGroup-${row.chapters[0]?.novelId}`
                : `download-${row.chapter.id}`
            }
            header={
              <List.InfoItem
                title={getString('downloadScreen.storageInfo')}
                theme={theme}
              />
            }
            renderItem={row => {
              const group = row.kind === 'group' ? row.chapters : [row.chapter];
              const novelId = group[0]?.novelId;
              const content = (
                <DownloadedNovelChapterGroup
                  chapters={group}
                  chapterCountLabel={getString('downloadScreen.downloadsLower')}
                  expanded={expanded.has(novelId)}
                  onToggleExpanded={() => toggleExpanded(novelId)}
                  onDeleteChapter={chapter => {
                    deleteChapter(
                      chapter.pluginId,
                      chapter.novelId,
                      chapter.id,
                    ).then(() => {
                      showToast(
                        `${getString('common.delete')} ${chapter.name}`,
                      );
                      getChapters();
                    });
                  }}
                />
              );
              return row.kind === 'chapter' ? (
                <Box modifiers={[padding(24, 0, 0, 0)]}>{content}</Box>
              ) : (
                content
              );
            }}
            footer={
              chapters.length ? null : (
                <EmptyView
                  icon="(˘･_･˘)"
                  description={getString('downloadScreen.noDownloads')}
                />
              )
            }
          />
        )
      }
      overlays={
        <RemoveDownloadsDialog
          dialogVisible={visible}
          hideDialog={hideDialog}
          onSubmit={async () => {
            try {
              await deleteDownloads(chapters);
              setChapters([]);
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
      }
    >
      {/* The storage note comes with the list, once there is one to explain. */}
      {loading ? <UpdatesSkeletonLoading theme={theme} /> : null}
    </Screen>
  );
};

export default Downloads;
