import {
  isChapterRefreshUrl,
  isPluginIssueReportUrl,
} from './sanitizeChapterText';

type LinkActions = {
  openNovel(url: string): boolean;
  openExternal(url: string): void;
  inject(script: string): void;
  refresh(): void;
};

const SAME_WINDOW_TARGETS = ['', '_self', '_parent', '_top'];

/**
 * Routes a link from the reader page. Page messages, native load requests, and
 * new windows use the same rules.
 */
export function createReaderLinkHandlers(actions: LinkActions) {
  // Returns true when the app handled the URL, so the WebView must not load it.
  const handleInApp = (url: string): boolean => {
    if (isPluginIssueReportUrl(url)) {
      actions.openExternal(url);
      return true;
    }
    if (isChapterRefreshUrl(url)) {
      actions.refresh();
      return true;
    }
    return actions.openNovel(url);
  };

  const shouldStartLoad = (url: string): boolean => !handleInApp(url);

  const openWindow = (url: string): void => {
    if (/^(about|javascript):/i.test(url)) {
      return;
    }
    if (!handleInApp(url)) {
      actions.openExternal(url);
    }
  };

  const handlePage = (data: unknown): void => {
    if (
      !data ||
      typeof data !== 'object' ||
      !('url' in data) ||
      typeof data.url !== 'string' ||
      !/^https?:/i.test(data.url)
    ) {
      return;
    }
    const url = data.url;
    if (handleInApp(url)) {
      return;
    }
    const target =
      'target' in data && typeof data.target === 'string'
        ? data.target.toLowerCase()
        : '';
    if (SAME_WINDOW_TARGETS.includes(target)) {
      actions.inject(`window.location.href = ${JSON.stringify(url)}; true;`);
    } else {
      actions.openExternal(url);
    }
  };

  return { handlePage, shouldStartLoad, openWindow };
}
