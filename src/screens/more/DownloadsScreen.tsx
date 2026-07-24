import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet } from 'react-native';

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
import DownloadedNovelChapterGroup from './components/DownloadedNovelChapterGroup';
import { getString } from '@strings/translations';
import { DownloadsScreenProps } from '@navigators/types';
import { DownloadedChapter } from '@database/types';
import { showToast } from '@utils/showToast';
import dayjs from 'dayjs';
import { parseChapterNumber } from '@utils/parseChapterNumber';

type DownloadGroup = Record<number, DownloadedChapter[]>;

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
  const [loading, setLoading] = useState(true);
  const [chapters, setChapters] = useState<DownloadedChapter[]>([]);

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
        const parsedTime = dayjs(download.releaseTime);
        return {
          ...download,
          releaseTime: parsedTime.isValid()
            ? parsedTime.format('LL')
            : download.releaseTime,
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

      <List.InfoItem title={getString('downloadScreen.dbInfo')} theme={theme} />
      {loading ? (
        <UpdatesSkeletonLoading theme={theme} />
      ) : (
        <FlatList
          contentContainerStyle={styles.flatList}
          data={groupChaptersByNovel(chapters)}
          keyExtractor={item => `downloadGroup-${item[0]?.novelId}`}
          renderItem={({ item }) => {
            return (
              <DownloadedNovelChapterGroup
                chapters={item}
                chapterCountLabel={getString('downloadScreen.downloadsLower')}
                onDeleteChapter={chapter => {
                  deleteChapter(
                    chapter.pluginId,
                    chapter.novelId,
                    chapter.id,
                  ).then(() => {
                    showToast(`${getString('common.delete')} ${chapter.name}`);
                    getChapters();
                  });
                }}
              />
            );
          }}
          ListEmptyComponent={
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
        onSubmit={() => {
          deleteDownloads(chapters);
          setChapters([]);
          hideDialog();
        }}
      />
    </SafeAreaView>
  );
};

export default Downloads;

const styles = StyleSheet.create({
  container: { flex: 1 },
  flatList: { flexGrow: 1, paddingVertical: 8 },
});
