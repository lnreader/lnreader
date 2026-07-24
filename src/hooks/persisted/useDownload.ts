import { ChapterInfo, NovelInfo } from '@database/types';
import {
  BACKGROUND_TASKS_STORE_KEY,
  BackgroundTaskMetadata,
  backgroundTasks,
  DownloadChapterTask,
  QueuedBackgroundTask,
} from '@services/backgroundTasks';
import { useMemo } from 'react';
import { useMMKVObject } from 'react-native-mmkv';

export const DOWNLOAD_QUEUE = 'DOWNLOAD';
export const CHAPTER_DOWNLOADING = 'CHAPTER_DOWNLOADING';

export default function useDownload() {
  const [queue] = useMMKVObject<QueuedBackgroundTask[]>(
    BACKGROUND_TASKS_STORE_KEY,
  );

  const downloadQueue = useMemo(
    () => queue?.filter(t => t.task?.name === 'DOWNLOAD_CHAPTER') || [],
    [queue],
  ) as { task: DownloadChapterTask; meta: BackgroundTaskMetadata }[];

  const downloadingChapterIds = useMemo(
    () =>
      new Set(
        downloadQueue.flatMap(item =>
          item.task.data.chapters.map(chapter => chapter.chapterId),
        ),
      ),
    [downloadQueue],
  );

  const downloadingNovelIds = useMemo(
    () =>
      new Set(
        downloadQueue.flatMap(item =>
          item.task.data.novelId === undefined ? [] : [item.task.data.novelId],
        ),
      ),
    [downloadQueue],
  );

  const downloadChapter = (novel: NovelInfo, chapter: ChapterInfo) =>
    backgroundTasks.enqueue({
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: novel.name,
        novelId: novel.id,
        chapters: [{ chapterId: chapter.id, chapterName: chapter.name }],
      },
    });
  const downloadChapters = (novel: NovelInfo, chapters: ChapterInfo[]) =>
    backgroundTasks.enqueue({
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: novel.name,
        novelId: novel.id,
        chapters: chapters.map(chapter => ({
          chapterId: chapter.id,
          chapterName: chapter.name,
        })),
      },
    });
  const resumeDownload = () => backgroundTasks.resumeAll();

  const pauseDownload = () => backgroundTasks.pauseAll();

  const cancelDownload = () => backgroundTasks.cancelByType('DOWNLOAD_CHAPTER');

  return {
    downloadQueue,
    downloadingChapterIds,
    downloadingNovelIds,
    resumeDownload,
    downloadChapter,
    downloadChapters,
    pauseDownload,
    cancelDownload,
    enqueueTasks: backgroundTasks.enqueue,
  };
}
