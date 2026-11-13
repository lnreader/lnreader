import { ChapterInfo, NovelInfo } from '@database/types';
import { backgroundTasks } from '@services/backgroundTasks';
import { useDownloadIndex } from './useBackgroundTasks';

export const DOWNLOAD_QUEUE = 'DOWNLOAD';
export const CHAPTER_DOWNLOADING = 'CHAPTER_DOWNLOADING';

export default function useDownload() {
  const { chapterIds: downloadingChapterIds, novelIds: downloadingNovelIds } =
    useDownloadIndex();

  const downloadChapter = (novel: NovelInfo, chapter: ChapterInfo) =>
    backgroundTasks.enqueue({
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: novel.name,
        novelId: novel.id,
        pluginId: novel.pluginId,
        chapters: [{ chapterId: chapter.id, chapterName: chapter.name }],
      },
    });
  const downloadChapters = (
    novel: NovelInfo,
    chapters: Pick<ChapterInfo, 'id' | 'name'>[],
  ) =>
    backgroundTasks.enqueue({
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: novel.name,
        novelId: novel.id,
        pluginId: novel.pluginId,
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
