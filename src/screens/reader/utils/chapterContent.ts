import type { ChapterInfo, NovelInfo } from '@database/types';
import type { ChapterTextCacheApi } from '@hooks/persisted/useNovel/store/novelStore.types';
import NativeFile from '@modules/native-file';
import { fetchChapter } from '@services/plugin/fetch';
import { NOVEL_STORAGE } from '@utils/Storages';
import { sanitizeChapterText } from './sanitizeChapterText';

/**
 * Reads the chapter from local storage, falling back to the plugin when it
 * is not downloaded. A single `readFile` doubles as the existence check to
 * save a native round trip on the critical path of a downloaded chapter.
 */
const loadChapterText = async (novel: NovelInfo, chapter: ChapterInfo) => {
  const filePath = `${NOVEL_STORAGE}/${novel.pluginId}/${chapter.novelId}/${chapter.id}/index.html`;
  try {
    return await NativeFile.readFile(filePath);
  } catch {
    return await fetchChapter(novel.pluginId, chapter.path);
  }
};

/**
 * Returns render-ready (sanitized) chapter HTML, reusing the novel-scoped
 * cache. Sanitizing before caching keeps `sanitize-html` – which is the most
 * expensive synchronous step of a chapter load – off the critical path.
 * In-flight loads are cached as promises so the same chapter is never loaded
 * twice concurrently.
 */
export const loadChapterHtml = (
  cache: ChapterTextCacheApi,
  novel: NovelInfo,
  chapter: ChapterInfo,
): Promise<string> => {
  const cached = cache.read(chapter.id);
  if (cached) {
    return Promise.resolve(cached);
  }
  const pending = loadChapterText(novel, chapter).then(text => {
    if (!text.trim()) {
      cache.remove(chapter.id);
    }
    return sanitizeChapterText(novel.pluginId, novel.name, chapter.name, text);
  });
  cache.write(chapter.id, pending);
  // Never keep a failed load in the cache, otherwise a retry would
  // resolve instantly with the same failure.
  pending.catch(() => cache.remove(chapter.id));
  return pending;
};

export const readPluginFile = async (path: string) => {
  try {
    return await NativeFile.readFile(path);
  } catch {
    return '';
  }
};
