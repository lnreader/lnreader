/**
 * Procedural fixture generator for EPUB import tests (spec-1997 R2).
 *
 * Emits synthetic epub structures as PLAIN DATA driving the mocked seams —
 * zero committed binaries, deterministic from config alone (same config →
 * same structure; no timestamps, no randomness).
 */

export interface FixtureChapter {
  path: string;
  name?: string;
}

export interface ParsedNovelFixture {
  name: string;
  cover?: string;
  author?: string;
  artist?: string;
  summary?: string;
  chapters: { path: string; name?: string }[];
  imagePaths: string[];
  cssPaths: string[];
}

export interface EpubFixture {
  filename: string;
  /** Files that NativeFile.exists() reports as present after unzip. */
  existingFiles: string[];
  /** Body text every readFile call returns. */
  chapterBody: string;
  /** The object parseNovelAndChapters resolves with. */
  parsedNovel: ParsedNovelFixture;
}

export interface FixtureConfig {
  filename: string;
  novelName: string;
  chapters: FixtureChapter[];
  images: string[];
  css: string[];
  cover?: string;
  author?: string;
}

export const buildFixture = (config: FixtureConfig): EpubFixture => {
  const existingFiles = new Set<string>();

  // Chapter source files exist on disk (readFile feeds insertLocalChapter).
  for (const chapter of config.chapters) {
    existingFiles.add(chapter.path);
  }
  // Images and css exist unless the caller strips them (missing-source case
  // is exercised by editing existingFiles after buildFixture).
  for (const image of config.images) {
    existingFiles.add(image);
  }
  for (const css of config.css) {
    existingFiles.add(css);
  }

  const parsedNovel: ParsedNovelFixture = {
    // Empty name exercises the filename-derived fallback in importEpub.
    name: config.novelName,
    chapters: config.chapters.map(chapter => ({ ...chapter })),
    imagePaths: [...config.images],
    cssPaths: [...config.css],
  };
  if (config.cover) {
    parsedNovel.cover = config.cover;
    existingFiles.add(config.cover);
  }
  if (config.author !== undefined) {
    parsedNovel.author = config.author;
  }

  return {
    filename: config.filename,
    existingFiles: [...existingFiles],
    chapterBody: '<p>fixture chapter body</p>',
    parsedNovel,
  };
};
