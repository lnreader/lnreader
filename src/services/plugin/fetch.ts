import { getPlugin } from '@plugins/pluginManager';
import { isUrlAbsolute } from '@plugins/helpers/isAbsoluteUrl';
import { ChapterItem } from '@plugins/types';

function formatChapters<T extends ChapterItem[] | undefined>(chapters: T): T {
  if (!chapters) {
    return undefined as T;
  }
  return chapters.map(ch => {
    if (Array.isArray(ch.scanlator)) {
      return {
        ...ch,
        scanlator: ch.scanlator.join(', '),
      };
    }
    return ch;
  }) as T;
}

export const fetchNovel = async (pluginId: string, novelPath: string) => {
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginId}`);
  }
  const res = await plugin.parseNovel(novelPath);
  if (res?.chapters) {
    res.chapters = formatChapters(res.chapters);
  }
  return res;
};

export const fetchChapter = async (pluginId: string, chapterPath: string) => {
  const plugin = getPlugin(pluginId);
  let chapterText = `Unknown plugin: ${pluginId}`;
  if (plugin) {
    chapterText = await plugin.parseChapter(chapterPath);
  }
  return chapterText;
};

export const fetchChapters = async (pluginId: string, novelPath: string) => {
  const plugin = getPlugin(pluginId);
  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginId}`);
  }
  const res = await plugin.parseNovel(novelPath);
  return formatChapters(res?.chapters);
};

export const fetchPage = async (
  pluginId: string,
  novelPath: string,
  page: string,
) => {
  const plugin = getPlugin(pluginId);

  if (!plugin) {
    throw new Error(`Unknown plugin: ${pluginId}`);
  }

  if (!plugin.parsePage) {
    throw new Error(`Could not fetch chapters for page ${page}`);
  }
  const res = await plugin.parsePage(novelPath, page);
  if (res?.chapters) {
    res.chapters = formatChapters(res.chapters);
  }
  return res;
};

export const resolveUrl = (
  pluginId: string,
  path: string,
  isNovel?: boolean,
) => {
  if (isUrlAbsolute(path)) {
    return path;
  }
  const plugin = getPlugin(pluginId);
  try {
    if (!plugin) {
      throw new Error(`Unknown plugin: ${pluginId}`);
    }
    if (plugin.resolveUrl) {
      return plugin.resolveUrl(path, isNovel);
    }
  } catch {
    return path;
  }
  return plugin.site + path;
};
