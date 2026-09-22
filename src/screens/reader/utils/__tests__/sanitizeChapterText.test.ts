import { getString } from '@i18n/translations';

import {
  CHAPTER_REFRESH_URL,
  isChapterRefreshUrl,
  isPluginIssueReportUrl,
  sanitizeChapterText,
} from '../sanitizeChapterText';

jest.mock('@i18n/translations', () => ({
  getString: jest.fn(
    (
      _key: string,
      options: {
        pluginId: string;
        novelName: string;
        chapterName: string;
        reportUrl: string;
        refreshUrl: string;
      },
    ) =>
      [
        options.pluginId,
        options.novelName,
        options.chapterName,
        options.reportUrl,
        options.refreshUrl,
      ].join('|'),
  ),
}));

jest.mock('sanitize-html', () => {
  const sanitize = Object.assign(
    jest.fn((html: string) =>
      html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ''),
    ),
    { defaults: { allowedTags: ['p'] } },
  );

  return {
    __esModule: true,
    default: sanitize,
  };
});

const mockGetString = jest.mocked(getString);

describe('sanitizeChapterText', () => {
  it('sanitizes and returns chapter content when the plugin provides it', () => {
    expect(
      sanitizeChapterText(
        'plugin.test',
        'Novel',
        'Chapter 1',
        '<p>Content</p><script>alert("no")</script>',
      ),
    ).toBe('<p>Content</p>');
    expect(mockGetString).not.toHaveBeenCalled();
  });

  it('provides a safe, prefilled plugin report when no content remains', () => {
    const result = sanitizeChapterText(
      'plugin.test',
      'A <Novel>',
      'Chapter 1 & "After"',
      '<script>alert("no")</script>',
    );

    expect(mockGetString).toHaveBeenCalledWith(
      'readerScreen.emptyChapterMessage',
      expect.objectContaining({
        pluginId: 'plugin.test',
        novelName: 'A &lt;Novel&gt;',
        chapterName: 'Chapter 1 &amp; &quot;After&quot;',
        refreshUrl: CHAPTER_REFRESH_URL,
      }),
    );
    expect(result).toContain('template=report_issue.yml');
    expect(result).toContain(
      'title=%5Bplugin.test%5D+Empty+chapter%3A+A+%3CNovel%3E+%E2%80%94+Chapter+1+%26+%22After%22',
    );
    expect(result).toContain('labels=Bug');
    expect(result).toContain(
      'body=**Plugin%3A**+plugin.test%0A**Novel%3A**+A+%3CNovel%3E%0A**Chapter%3A**+Chapter+1+%26+%22After%22',
    );
    expect(result).toContain(CHAPTER_REFRESH_URL);
  });
});

describe('isPluginIssueReportUrl', () => {
  it('only matches the plugin issue form', () => {
    expect(
      isPluginIssueReportUrl(
        'https://github.com/lnreader/lnreader-plugins/issues/new?template=report_issue.yml',
      ),
    ).toBe(true);
    expect(
      isPluginIssueReportUrl(
        'https://github.com/lnreader/lnreader-plugins/issues/new-malicious',
      ),
    ).toBe(false);
  });
});

describe('isChapterRefreshUrl', () => {
  it('matches the refresh-chapter custom scheme', () => {
    expect(isChapterRefreshUrl(CHAPTER_REFRESH_URL)).toBe(true);
    expect(isChapterRefreshUrl('lnreader://refresh-chapter?x=1')).toBe(false);
    expect(isChapterRefreshUrl('https://example.com')).toBe(false);
  });
});
