import type { ChapterInfo, NovelInfo } from '@database/types';
import { getString } from '@i18n/translations';
import type { ImageRequestInit } from '@plugins/types';

/** Everything that differs between chapters shown in the same reader page. */
export type ChapterPayload = {
  chapter: ChapterInfo;
  novel: NovelInfo;
  html: string;
  strings: {
    finished: string;
    noNextChapter: string;
    loadingNextChapter: string;
    nextChapterLoadFailed: string;
    retry: string;
    removeText: string;
    replaceText: string;
  };
  nextChapterScreenVisible: boolean;
};

export const buildChapterPayload = ({
  chapter,
  novel,
  html,
  nextChapterScreenVisible,
}: {
  chapter: ChapterInfo;
  novel: NovelInfo;
  html: string;
  nextChapterScreenVisible: boolean;
}): ChapterPayload => ({
  chapter,
  novel,
  html,
  strings: {
    finished: `${getString('readerScreen.finished')}: ${chapter.name.trim()}`,
    noNextChapter: getString('readerScreen.noNextChapter'),
    loadingNextChapter: getString('readerScreen.loadingNextChapter'),
    nextChapterLoadFailed: getString('readerScreen.nextChapterLoadFailed'),
    retry: getString('common.retry'),
    removeText: getString('common.remove'),
    replaceText: getString('customCodeSettings.replace'),
  },
  nextChapterScreenVisible,
});

/**
 * The inputs of the reader page that cannot be changed in a loaded document.
 * Reader and general settings are deliberately absent: they are pushed into
 * the page with `injectJavaScript` whenever they change.
 */
export type ReaderShellKey = {
  pluginId: string | undefined;
  /**
   * The document's base URL, which is also its origin. A `<base href>` would
   * only change how relative URLs resolve, not the origin that file access,
   * cookies and CORS are decided by, so a change needs a new document.
   */
  baseUrl: string | undefined;
  requestInit: string;
  readerDir: 'ltr' | 'rtl';
  theme: string;
  customJS: string;
  customCSS: string;
  /** Whether the plugin ships a `custom.js` that runs inside the page. */
  pluginCustomJS: boolean;
};

export const buildShellKey = ({
  plugin,
  isDownloaded,
  pluginCustomJS,
  readerDir,
  theme,
  customJS,
  customCSS,
}: {
  plugin?: { id: string; site: string; imageRequestInit?: ImageRequestInit };
  isDownloaded?: boolean | null;
  pluginCustomJS: boolean;
  readerDir: 'ltr' | 'rtl';
  theme: object;
  customJS: string;
  customCSS: string;
}): ReaderShellKey => ({
  pluginId: plugin?.id,
  baseUrl: isDownloaded ? undefined : plugin?.site,
  requestInit: JSON.stringify(plugin?.imageRequestInit ?? null),
  readerDir,
  theme: JSON.stringify(theme),
  customJS,
  customCSS,
  pluginCustomJS,
});

const SHELL_KEY_FIELDS: (keyof ReaderShellKey)[] = [
  'pluginId',
  'baseUrl',
  'requestInit',
  'readerDir',
  'theme',
  'customJS',
  'customCSS',
  'pluginCustomJS',
];

export const isSameShellKey = (a: ReaderShellKey, b: ReaderShellKey) =>
  SHELL_KEY_FIELDS.every(field => a[field] === b[field]);

/**
 * Whether a chapter change needs a freshly loaded reader page, rather than
 * swapping the chapter into the loaded one with `reader.setChapter`.
 */
export const shouldReloadShell = (
  prev: ReaderShellKey | undefined,
  next: ReaderShellKey,
  { shellReady }: { shellReady: boolean },
): boolean => {
  // Anything injected before the page has loaded would be dropped.
  if (!prev || !shellReady) {
    return true;
  }
  // Plugin scripts were written for a fresh document per chapter.
  if (next.pluginCustomJS) {
    return true;
  }
  return !isSameShellKey(prev, next);
};

/**
 * JSON that is also safe inside an inline `<script>`: a `</script>` in a
 * chapter name or body would otherwise end the script element early.
 */
export const serializeForScript = (value: unknown) =>
  JSON.stringify(value).replace(/</g, '\\u003c');

export const buildReaderCustomScript = (customJS: string) => `
  function fn(
    lnTarget = document.querySelector('#LNReader-chapter'),
    lnChapter = reader.chapter
  ) {
    let novelName = reader.novel.name;
    let chapterName = lnChapter.name;
    let sourceId = reader.novel.pluginId;
    let chapterId = lnChapter.id;
    let novelId = lnChapter.novelId;
    let html = lnTarget.innerHTML;
    ${customJS}
    lnTarget.innerHTML = html;
  }
  window.lnApplyCustomJS = fn;
  document.addEventListener('DOMContentLoaded', () => fn());
`;

export const buildSetChapterScript = (payload: ChapterPayload) => `
  (function () {
    if (window.reader && window.reader.setChapter) {
      window.reader.setChapter(${serializeForScript(payload)});
    } else {
      window.ReactNativeWebView.postMessage(${JSON.stringify(
        JSON.stringify({
          type: 'chapter-swap-failed',
          chapterId: payload.chapter.id,
        }),
      )});
    }
  })();
  true;
`;

/**
 * Performance marks for comparing chapter changes in RN DevTools or Perfetto:
 * from the chapter request to the swapped chapter being shown, or to the
 * reloaded page finishing its load.
 */
const CHAPTER_REQUEST_MARK = 'reader:chapter-request';

export const markChapterRequest = () => {
  try {
    performance.mark(CHAPTER_REQUEST_MARK);
  } catch {
    // Timing is diagnostics only.
  }
};

export const measureChapterShown = (kind: 'swap' | 'reload') => {
  try {
    if (performance.getEntriesByName(CHAPTER_REQUEST_MARK).length === 0) {
      return;
    }
    performance.measure(`reader:chapter-${kind}`, CHAPTER_REQUEST_MARK);
    performance.clearMarks(CHAPTER_REQUEST_MARK);
  } catch {
    // Timing is diagnostics only.
  }
};
