import { Pressable, StyleSheet, View, Image } from 'react-native';
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import {
  ChapterInfo,
  DownloadedChapter,
  NovelInfo,
  Update,
  UpdateOverview,
} from '@database/types';
import { List } from 'react-native-paper';
import { NavigationProp, useNavigation } from '@react-navigation/native';
import ChapterItem from '@screens/novel/components/ChapterItem';
import { useDownload, useTheme, useUpdates } from '@hooks/persisted';
import { RootStackParamList } from '@navigators/types';
import { FlatList } from 'react-native-gesture-handler';
import { defaultCover } from '@plugins/helpers/constants';
import { ThemeColors } from '@theme/types';

type UpdateCardProps = {
  onlyDownloadedChapters?: boolean;
  descriptionText: string;
  deleteChapter: (chapter: Update | DownloadedChapter) => void;
} & (
    | { chapterList: Update[] | DownloadedChapter[]; chapterListInfo?: undefined }
    | {
      chapterListInfo: UpdateOverview;
      chapterList?: undefined;
    }
  );

const UpdateNovelCard: React.FC<UpdateCardProps> = ({
  onlyDownloadedChapters = false,
  chapterList: chapterListRaw,
  chapterListInfo: chapterListInfoRaw,
  descriptionText,
  deleteChapter,
}) => {
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { downloadChapter, downloadQueue } = useDownload();
  const { getDetailedUpdates, isLoading } = useUpdates();
  const [chapterList, setChapterList] = useState<
    Update[] | DownloadedChapter[]
  >(chapterListRaw ?? []);

  const chapterListInfo = chapterListInfoRaw ?? {
    novelId: chapterList![0]?.novelId,
    novelName: chapterList![0]?.novelName,
    updateDate: chapterList![0]?.updatedTime ?? '',
    updatesPerDay: chapterList?.length,
    novelCover: chapterList![0]?.novelCover ?? '',
  };

  const theme = useTheme();

  const updateList = useCallback(async () => {
    getDetailedUpdates(chapterListInfo.novelId, onlyDownloadedChapters).then(
      res => {
        if (res.length) {
          setChapterList(res);
        }
      },
    );
  }, [chapterListInfo.novelId, getDetailedUpdates, onlyDownloadedChapters]);
  useEffect(() => {
    updateList();
  }, [updateList]);

  const handleDownloadChapter = (chapter: Update | DownloadedChapter) => {
    if (chapterListInfo.updatesPerDay) {
      downloadChapter(
        {
          id: chapter?.novelId,
          pluginId: chapter.pluginId,
          name: chapter.novelName,
        } as NovelInfo,
        chapter,
      );
    }
  };

  const navigateToChapter = useCallback(
    (chapter: ChapterInfo) => {
      const { novelPath, pluginId, novelName } = chapter as
        | Update
        | DownloadedChapter;
      navigate('ReaderStack', {
        screen: 'Chapter',
        params: {
          novel: {
            path: novelPath,
            pluginId: pluginId,
            name: novelName,
          } as NovelInfo,
          chapter: chapter,
        },
      });
    },
    [navigate],
  );

  const navigateToNovel = useCallback(() => {
    if (chapterListInfo.updatesPerDay) {
      navigate('ReaderStack', {
        screen: 'Novel',
        params: {
          pluginId: chapterList[0].pluginId,
          path: chapterList[0].novelPath,
          cover: chapterList[0].novelCover,
          name: chapterList[0].novelName,
        },
      });
    }
  }, [chapterList, chapterListInfo.updatesPerDay, navigate]);

  const styles = useMemo(() => createStyles(theme), [theme]);

  const Cover = useCallback(() => {
    const uri = chapterListInfo.novelCover || defaultCover;
    return (
      <Pressable onPress={navigateToNovel} style={styles.alignSelf}>
        <Image source={{ uri }} style={styles.cover} />
      </Pressable>
    );
  }, [
    chapterListInfo.novelCover,
    navigateToNovel,
    styles.alignSelf,
    styles.cover,
  ]);

  if (chapterListInfo.updatesPerDay > 1) {
    return (
      <List.Accordion
        title={chapterListInfo.novelName}
        titleStyle={styles.title}
        left={Cover}
        descriptionStyle={styles.description}
        theme={{ colors: theme }}
        style={[styles.container, styles.padding]}
        description={`${chapterListInfo.updatesPerDay} ${descriptionText}`}
        onPress={updateList}
      >
        {chapterList.length > 0 ? (
          <FlatList
            data={chapterList}
            keyExtractor={it => 'update' + it.id}
            extraData={[chapterList, isLoading]}
            style={styles.chapterList}
            renderItem={({ item }) => {
              return (
                <ChapterItem
                  isLocal={false}
                  isDownloading={downloadQueue.some(c => {
                    return c.task.data.chapterId === item.id;
                  })}
                  isUpdateCard
                  novelName={chapterListInfo.novelName}
                  chapter={item}
                  theme={theme}
                  showChapterTitles={false}
                  downloadChapter={() => handleDownloadChapter(item)}
                  deleteChapter={() => deleteChapter(item)}
                  navigateToChapter={navigateToChapter}
                  left={
                    <View style={styles.novelCover}>
                      <Cover />
                    </View>
                  }
                />
              );
            }}
            scrollEnabled={false}
          />
        ) : (
          <></>
        )}
      </List.Accordion>
    );
  } else if (chapterListInfo.updatesPerDay > 0 && chapterList[0]) {
    return (
      <ChapterItem
        isLocal={false}
        isDownloading={downloadQueue.some(
          c => c.task.data.chapterId === chapterList[0]?.id,
        )}
        isUpdateCard
        novelName={chapterListInfo.novelName}
        chapter={chapterList[0]}
        theme={theme}
        showChapterTitles={false}
        downloadChapter={() => handleDownloadChapter(chapterList[0])}
        deleteChapter={() => deleteChapter(chapterList[0])}
        navigateToChapter={navigateToChapter}
        left={
          <View style={styles.novelCover}>
            <Cover />
          </View>
        }
      />
    );
  }
  return null;
};

export default memo(UpdateNovelCard);

function createStyles(theme: ThemeColors) {
  return StyleSheet.create({
    alignSelf: { alignSelf: 'center' },
    chapterList: {
      marginStart: -40,
    },
    container: {
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cover: {
      borderRadius: 4,
      height: 40,
      width: 40,
    },
    description: { fontSize: 12 },
    novelCover: {
      marginEnd: 8,
    },
    padding: {
      paddingHorizontal: 16,
      paddingVertical: 2,
    },
    title: { color: theme.onSurface, fontSize: 14 },
  });
}
