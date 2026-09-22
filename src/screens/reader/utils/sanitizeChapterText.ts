import { getString } from '@i18n/translations';
import sanitizeHtml from 'sanitize-html';

const PLUGIN_ISSUE_REPORT_URL =
  'https://github.com/lnreader/lnreader-plugins/issues/new';

/** Custom scheme intercepted by the reader WebView to re-fetch the chapter. */
export const CHAPTER_REFRESH_URL = 'lnreader://refresh-chapter';

export const isPluginIssueReportUrl = (url: string): boolean =>
  url === PLUGIN_ISSUE_REPORT_URL ||
  url.startsWith(`${PLUGIN_ISSUE_REPORT_URL}?`);

export const isChapterRefreshUrl = (url: string): boolean =>
  url === CHAPTER_REFRESH_URL;

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[character] as string),
  );

const getPluginIssueReportUrl = (
  pluginId: string,
  novelName: string,
  chapterName: string,
): string => {
  const title = `[${pluginId}] Empty chapter: ${novelName} — ${chapterName}`;
  // Pre-fill the label and body too: if the linked GitHub form template
  // fails to load (e.g. the browser drops the query string during a
  // sign-in redirect), GitHub falls back to a blank issue and these are
  // the only details that survive.
  const body = [
    `**Plugin:** ${pluginId}`,
    `**Novel:** ${novelName}`,
    `**Chapter:** ${chapterName}`,
  ].join('\n');

  const params = new URLSearchParams({
    template: 'report_issue.yml',
    title,
    labels: 'Bug',
    body,
  });

  return `${PLUGIN_ISSUE_REPORT_URL}?${params.toString()}`;
};

/** Built once: rebuilding it per chapter allocates the whole tag list again. */
const sanitizeOptions: sanitizeHtml.IOptions = {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat([
    'html',
    'head',
    'body',
    'link',
    'style',
    'meta',
    'del',
    'ins',
    'img',
    'audio',
    'video',
    'source',
    'object',
    'svg',
    'math',
    'title',
    'details',
    'summary',
    'ref',
  ]),
  allowedAttributes: {
    '*': [
      'data-*',
      'class',
      'id',
      'lang',
      'dir',
      'title',
      'epub:type',
      'role',
      'aria-label',
      'aria-labelledby',
      'aria-describedby',
    ],
    a: ['href', 'name', 'target'],
    img: ['src', 'srcset', 'alt', 'width', 'height', 'loading'],
    ol: ['reversed', 'start', 'type'],
    ul: ['type'],
    li: ['value'],
    p: ['align'],
    ref: ['href'],
    blockquote: ['cite'],
    table: ['border', 'cellpadding', 'cellspacing', 'width', 'summary'],
    td: ['colspan', 'rowspan', 'align', 'valign'],
    th: ['colspan', 'rowspan', 'align', 'valign', 'scope'],
    audio: ['src', 'controls'],
    video: ['src', 'controls', 'width', 'height'],
    source: ['src', 'type', 'srcset'],
    svg: ['width', 'height', 'viewBox', 'xmlns'],
    q: ['cite'],
    time: ['datetime'],
    del: ['cite', 'datetime'],
    ins: ['cite', 'datetime'],
    link: ['rel', 'type', 'href', 'media'],
    meta: ['charset', 'name', 'content', 'http-equiv'],
  },
  allowedSchemes: ['data', 'http', 'https', 'file'],
};

export const sanitizeChapterText = (
  pluginId: string,
  novelName: string,
  chapterName: string,
  html: string,
): string => {
  const text = sanitizeHtml(html, sanitizeOptions);

  return (
    text ||
    getString('readerScreen.emptyChapterMessage', {
      pluginId: escapeHtml(pluginId),
      novelName: escapeHtml(novelName),
      chapterName: escapeHtml(chapterName),
      reportUrl: escapeHtml(
        getPluginIssueReportUrl(pluginId, novelName, chapterName),
      ),
      refreshUrl: escapeHtml(CHAPTER_REFRESH_URL),
    })
  );
};
