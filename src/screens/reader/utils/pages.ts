import {
  getChapterCount,
  insertChapters,
} from '@database/queries/ChapterQueries';
import { getReaderChapters } from '@database/queries/ReaderQueries';
import type { ChapterInfo, NovelInfo } from '@database/types';
import { fetchPage } from '@services/plugin/fetch';

/** `undefined` when there is no such page. */
export const loadAdjacentPage = async (
  novel: NovelInfo,
  chapters: readonly ChapterInfo[],
  direction: 'next' | 'prev',
  excludedScanlators?: string[],
): Promise<ChapterInfo[] | undefined> => {
  const totalPages = novel.totalPages ?? 0;
  const edge =
    direction === 'next' ? chapters[chapters.length - 1] : chapters[0];
  const edgePage = Number(edge?.page);
  const hasPage =
    direction === 'next'
      ? totalPages > 0 && edgePage < totalPages
      : edgePage > 1;
  if (!edge || !hasPage) {
    return undefined;
  }
  const target = direction === 'next' ? edgePage + 1 : edgePage - 1;
  const page = String(target);
  if ((await getChapterCount(novel.id, page)) === 0) {
    const sourcePage = await fetchPage(novel.pluginId, novel.path, page);
    await insertChapters(
      novel.id,
      sourcePage.chapters.map(chapter => ({ ...chapter, page })),
    );
  }
  const refreshed = await getReaderChapters(novel.id, excludedScanlators);
  return refreshed.length > chapters.length ? refreshed : undefined;
};
