import dayjs from 'dayjs';
import {
  updateNovelCategoryById,
  updateNovelInfo,
} from '@database/queries/NovelQueries';
import { LOCAL_PLUGIN_ID } from '@plugins/pluginManager';
import { getString } from '@strings/translations';
import { NOVEL_STORAGE } from '@utils/Storages';
import { dbManager } from '@database/db';
import { novelSchema, chapterSchema } from '@database/schema';
import {
  getNovelChapters,
  insertChapters,
} from '@database/queries/ChapterQueries';
import { BackgroundTaskMetadata } from '@services/ServiceManager';
import NativeFile from '@specs/NativeFile';
import NativeZipArchive from '@specs/NativeZipArchive';
import NativeEpub from '@specs/NativeEpub';
import { eq } from 'drizzle-orm';
import {
  decodePath,
  getExtension,
  getParentDir,
  getRelativePath,
  isDerivedName,
  isTitleOnlyChapter,
  normalizePath,
  resolveAssetPath,
  shouldSkipUrlRewrite,
} from './utils';

/** File extensions that should be copied as assets */
const ASSET_EXTENSIONS = new Set([
  'css',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'svg',
  'webp',
  'woff',
  'woff2',
  'ttf',
  'otf',
]);

/** HTML file extensions */
const HTML_EXTENSIONS = new Set(['xhtml', 'html', 'htm']);

type DefaultChapter = {
  name: string;
  path: string;
  releaseTime: string;
  chapterNumber: number;
  page: string;
};

/**
 * Rewrites asset URLs in chapter HTML to point to local copies.
 */
const rewriteChapterContent = (
  chapterText: string,
  chapterPath: string,
  epubRootPath: string,
  novelDir: string,
  assetRelativePaths: Set<string>,
) => {
  return chapterText.replace(
    /(\b(?:href|src))\s*=\s*(["'])([^"']+)\2/gi,
    (match, attr: string, quote: string, rawUrl: string) => {
      // Skip anchors, external URLs, etc.
      if (shouldSkipUrlRewrite(rawUrl)) {
        return match;
      }

      const urlMatch = rawUrl.match(/^([^?#]*)(.*)$/);
      const pathPart = urlMatch ? urlMatch[1] : rawUrl;
      const suffix = urlMatch ? urlMatch[2] : '';

      const extension = getExtension(pathPart);
      // For href, only rewrite asset links (not HTML pages)
      if (attr.toLowerCase() === 'href') {
        if (!extension || HTML_EXTENSIONS.has(extension)) {
          return match;
        }
        if (!ASSET_EXTENSIONS.has(extension)) {
          return match;
        }
      }

      // Resolve to absolute path and check if it's a tracked asset
      const absolutePath = resolveAssetPath(
        epubRootPath,
        chapterPath,
        pathPart,
      );
      if (!absolutePath) {
        return match;
      }

      const relativePath = getRelativePath(epubRootPath, absolutePath);
      if (!relativePath || !assetRelativePaths.has(relativePath)) {
        return match;
      }

      // Rewrite to local file:// URL
      const targetPath = `${normalizePath(novelDir)}/${relativePath}`;
      const newUrl = `file://${targetPath}${suffix}`;
      return `${attr}=${quote}${newUrl}${quote}`;
    },
  );
};

/**
 * Inserts a new local novel into the database.
 */
const insertLocalNovel = async (
  name: string,
  path: string,
  epubRootPath: string,
  cover?: string,
  author?: string,
  artist?: string,
  summary?: string,
) => {
  const { insertId } = await dbManager.write(async tx => {
    return tx
      .insert(novelSchema)
      .values({ name, path, pluginId: 'local', inLibrary: true, isLocal: true })
      .run();
  });

  if (insertId !== undefined && insertId >= 0) {
    // Add to "Local" category (id: 2)
    await updateNovelCategoryById(insertId, [2]);
    const novelDir = NOVEL_STORAGE + '/local/' + insertId;
    NativeFile.mkdir(novelDir);

    // Resolve cover path relative to epub root
    const decodedCoverPath = cover ? decodePath(cover) : '';
    const coverRelativePath = decodedCoverPath
      ? getRelativePath(epubRootPath, decodedCoverPath) ||
        decodedCoverPath.split(/[/\\]/).pop() ||
        ''
      : '';
    const newCoverPath = coverRelativePath
      ? `file://${novelDir}/${coverRelativePath}`
      : '';

    // Update novel with metadata
    await updateNovelInfo({
      id: insertId,
      pluginId: LOCAL_PLUGIN_ID,
      author: author,
      artist: artist,
      summary: summary,
      path: NOVEL_STORAGE + '/local/' + insertId,
      cover: newCoverPath,
      name: name,
      inLibrary: true,
      isLocal: true,
      totalPages: 0,
    });
    return insertId;
  }
  throw new Error(getString('advancedSettingsScreen.novelInsertFailed'));
};

/**
 * Writes chapter HTML content to disk.
 */
const writeChapterContent = (
  novelDir: string,
  chapterId: number,
  chapterText: string,
) => {
  const chapterDir = `${novelDir}/${chapterId}`;
  NativeFile.mkdir(chapterDir);
  NativeFile.writeFile(`${chapterDir}/index.html`, chapterText);
};

/**
 * Imports an EPUB file as a local novel.
 */
export const importEpub = async (
  {
    uri,
    filename,
  }: {
    uri: string;
    filename: string;
  },
  setMeta: (
    transformer: (meta: BackgroundTaskMetadata) => BackgroundTaskMetadata,
  ) => void,
) => {
  // Start import
  setMeta(meta => ({
    ...meta,
    isRunning: true,
    progress: 0,
  }));

  // Copy EPUB to cache directory
  const epubFilePath =
    NativeFile.getConstants().ExternalCachesDirectoryPath +
    `/novel_${Date.now()}_${Math.random().toString(16).slice(2)}.epub`;
  try {
    NativeFile.copyFile(uri, epubFilePath);
  } catch {
    throw new Error(
      `Failed to read EPUB file "${filename}". The file may have been moved or deleted. Please try importing again.`,
    );
  }

  // Extract EPUB to temp directory
  const epubDirPath =
    NativeFile.getConstants().ExternalCachesDirectoryPath +
    `/epub_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  if (NativeFile.exists(epubDirPath)) {
    NativeFile.unlink(epubDirPath);
  }
  NativeFile.mkdir(epubDirPath);
  await NativeZipArchive.unzip(epubFilePath, epubDirPath);

  // Parse novel metadata and chapters
  const novel = NativeEpub.parseNovelAndChapters(epubDirPath);
  // Fallback to filename if no title in epub
  if (!novel.name) {
    novel.name = filename.replace('.epub', '') || 'Untitled';
  }

  // Insert novel into database
  const novelId = await insertLocalNovel(
    novel.name,
    epubDirPath + novel.name, // temporary path
    epubDirPath,
    novel.cover || '',
    novel.author || '',
    novel.artist || '',
    novel.summary || '',
  );

  const now = dayjs().toISOString();

  // Collect all asset paths (images, css, cover)
  const assetPathByRelative = new Map<string, string>();
  const addAssetPath = (
    assetPath?: string | null,
    allowBasenameFallback = false,
  ) => {
    if (!assetPath) {
      return;
    }
    const decodedPath = decodePath(assetPath);
    const relativePath = getRelativePath(epubDirPath, decodedPath);
    const fallbackName = decodedPath.split(/[/\\]/).pop() || '';
    const finalRelativePath =
      relativePath || (allowBasenameFallback ? fallbackName : '');
    if (!finalRelativePath) {
      return;
    }
    if (!assetPathByRelative.has(finalRelativePath)) {
      assetPathByRelative.set(finalRelativePath, decodedPath);
    }
  };

  novel.imagePaths?.forEach(path => addAssetPath(path));
  novel.cssPaths?.forEach(path => addAssetPath(path));
  addAssetPath(novel.cover, true);
  const assetRelativePaths = new Set(assetPathByRelative.keys());

  const novelDir = NOVEL_STORAGE + '/local/' + novelId;
  const chaptersToInsert: DefaultChapter[] = [];
  const chapterContents: string[] = [];
  let pendingTitleName: string | null = null;
  let insertIndex = 0;

  // Process each chapter
  if (novel.chapters) {
    for (let i = 0; i < novel.chapters?.length; i++) {
      const chapter = novel.chapters[i];
      const fallbackName = chapter.path.split(/[/\\]/).pop() || 'unknown';
      let chapterName = chapter.name || fallbackName;

      // Apply pending title from title-only chapter
      if (pendingTitleName) {
        if (
          isDerivedName(chapterName, pendingTitleName) ||
          chapterName === fallbackName
        ) {
          chapterName = pendingTitleName;
        }
        pendingTitleName = null;
      }

      const chapterText = NativeFile.readFile(decodePath(chapter.path));

      // Skip title-only chapters (if there's a next chapter)
      if (chapterText && isTitleOnlyChapter(chapterName, chapterText)) {
        const hasNext = i + 1 < novel.chapters.length;
        if (hasNext) {
          pendingTitleName = chapterName;
          continue;
        }
      }
      // Skip empty chapters
      if (!chapterText) {
        continue;
      }

      // Update progress text
      setMeta(meta => ({
        ...meta,
        progressText: chapterName,
      }));

      // Rewrite asset URLs in chapter content
      const rewrittenChapterText = rewriteChapterContent(
        chapterText,
        chapter.path,
        epubDirPath,
        novelDir,
        assetRelativePaths,
      );

      chaptersToInsert.push({
        name: chapterName,
        path: `${novelDir}/${insertIndex}`,
        releaseTime: now,
        chapterNumber: insertIndex + 1,
        page: '1',
      });
      chapterContents.push(rewrittenChapterText);
      insertIndex += 1;

      // Update progress
      setMeta(meta => ({
        ...meta,
        progress: (i + 1) / novel.chapters.length,
      }));
    }
  }

  // Insert chapters into database and write content files
  if (chaptersToInsert.length) {
    await insertChapters(novelId, chaptersToInsert);

    // Mark all as downloaded
    await dbManager.write(async tx => {
      tx.update(chapterSchema)
        .set({ isDownloaded: true })
        .where(eq(chapterSchema.novelId, novelId))
        .run();
    });

    // Get inserted chapters to get their database IDs
    const insertedChapters = await getNovelChapters(
      novelId,
      'positionAsc',
      undefined,
      undefined,
      chaptersToInsert.length,
    );

    // Write each chapter's HTML to disk
    for (let i = 0; i < insertedChapters.length; i++) {
      const chapterRow = insertedChapters[i];
      const chapterText = chapterContents[i];
      if (!chapterText) {
        continue;
      }
      writeChapterContent(novelDir, chapterRow.id, chapterText);
    }
  }

  // Copy assets (images, css) to novel directory
  setMeta(meta => ({
    ...meta,
    progressText: getString('advancedSettingsScreen.importStaticFiles'),
  }));

  for (const [relativePath, absolutePath] of assetPathByRelative.entries()) {
    const decodedPath = decodePath(absolutePath);
    if (NativeFile.exists(decodedPath)) {
      const targetPath = `${novelDir}/${relativePath}`;
      const parentDir = getParentDir(targetPath);
      if (parentDir) {
        NativeFile.mkdir(parentDir);
      }
      NativeFile.moveFile(decodedPath, targetPath);
    }
  }

  // Complete
  setMeta(meta => ({
    ...meta,
    progress: 1,
    isRunning: false,
  }));
};
