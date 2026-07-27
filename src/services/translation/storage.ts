/**
 * Filesystem storage for translated chapter content.
 *
 * Spec constraint (§7, and PR #1851 review feedback): translated text is a
 * file, not a database column. It lives as a sibling of the downloaded
 * `index.html` inside the same chapter folder, so one chapter's assets —
 * including the images `downloadChapter` already rewrote to `file://` paths —
 * stay in a single directory, and "clear all translations" is a directory walk
 * rather than a migration.
 *
 *   {NOVEL_STORAGE}/{pluginId}/{novelId}/{chapterId}/index.html      (original)
 *   {NOVEL_STORAGE}/{pluginId}/{novelId}/{chapterId}/index.en.html   (translated)
 */
import NativeFile from '@modules/native-file';
import { NOVEL_STORAGE } from '@utils/Storages';

export interface ChapterLocation {
  pluginId: string;
  novelId: number;
  chapterId: number;
}

/**
 * Language codes become part of a filename, so anything outside the BCP-47
 * character set is rejected rather than escaped — a code that needs escaping
 * is a bug upstream, not something to paper over here.
 */
const LANG_PATTERN = /^[A-Za-z0-9-]{1,16}$/;

const assertLangCode = (targetLang: string): string => {
  if (!LANG_PATTERN.test(targetLang)) {
    throw new Error(`Unsafe target language code: ${targetLang}`);
  }
  return targetLang;
};

export const chapterFolderPath = ({
  pluginId,
  novelId,
  chapterId,
}: ChapterLocation): string =>
  `${NOVEL_STORAGE}/${pluginId}/${novelId}/${chapterId}`;

export const translatedChapterPath = (
  location: ChapterLocation,
  targetLang: string,
): string =>
  `${chapterFolderPath(location)}/index.${assertLangCode(targetLang)}.html`;

export const hasTranslatedChapter = (
  location: ChapterLocation,
  targetLang: string,
): Promise<boolean> =>
  NativeFile.exists(translatedChapterPath(location, targetLang));

/** Returns undefined when no translation is cached for this language. */
export const readTranslatedChapter = async (
  location: ChapterLocation,
  targetLang: string,
): Promise<string | undefined> => {
  try {
    return await NativeFile.readFile(
      translatedChapterPath(location, targetLang),
    );
  } catch {
    return undefined;
  }
};

export const writeTranslatedChapter = async (
  location: ChapterLocation,
  targetLang: string,
  html: string,
): Promise<void> => {
  // The folder exists for downloaded chapters but not for ones being read
  // straight from the plugin, and translation is explicitly not gated on
  // being downloaded (nor on the novel being remote — see §4).
  await NativeFile.mkdir(chapterFolderPath(location));
  await NativeFile.writeFile(translatedChapterPath(location, targetLang), html);
};

export const deleteTranslatedChapter = async (
  location: ChapterLocation,
  targetLang: string,
): Promise<void> => {
  const path = translatedChapterPath(location, targetLang);
  if (await NativeFile.exists(path)) {
    await NativeFile.unlink(path);
  }
};

/** Matches `index.<lang>.html` but never the original `index.html`. */
const TRANSLATION_FILE = /^index\.[A-Za-z0-9-]{1,16}\.html$/;

export const isTranslationFile = (name: string): boolean =>
  TRANSLATION_FILE.test(name);

/**
 * Removes every cached translation across all novels (spec §6.6).
 *
 * Walks plugin → novel → chapter directories and unlinks only files matching
 * the translation pattern, so downloaded originals and images are untouched.
 * Returns the number of files removed. Unreadable directories are skipped
 * rather than aborting the sweep, so one bad folder can't strand the rest.
 */
export const deleteAllTranslations = async (): Promise<number> => {
  let removed = 0;

  const safeReadDir = async (path: string) => {
    try {
      return await NativeFile.readDir(path);
    } catch {
      return [];
    }
  };

  for (const plugin of await safeReadDir(NOVEL_STORAGE)) {
    if (!plugin.isDirectory) {
      continue;
    }
    for (const novel of await safeReadDir(plugin.path)) {
      if (!novel.isDirectory) {
        continue;
      }
      for (const chapter of await safeReadDir(novel.path)) {
        if (!chapter.isDirectory) {
          continue;
        }
        for (const file of await safeReadDir(chapter.path)) {
          if (file.isDirectory || !isTranslationFile(file.name)) {
            continue;
          }
          try {
            await NativeFile.unlink(file.path);
            removed += 1;
          } catch {
            // Leave the count honest and keep sweeping.
          }
        }
      }
    }
  }

  return removed;
};
