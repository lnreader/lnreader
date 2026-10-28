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
    expect(result).toContain(
      'template=report_issue.yml&amp;title=%5Bplugin.test%5D%20Empty%20chapter%3A%20A%20%3CNovel%3E%20%E2%80%94%20Chapter%201%20%26%20%22After%22',
    );
    expect(result).toContain(CHAPTER_REFRESH_URL);
  });

  it('strips elements with display:none and honeypot classes', () => {
    const raw = `
      <p>Sunny entered the stone pavilion.</p>
      <p style="display:none">Hidden honeypot paragraph</p>
      <div style="font-size:0px">Zero font size trap</div>
      <p class="tts-trap">Screen scraper honeypot</p>
      <p>The shadows danced around the pillars.</p>
    `;

    const result = sanitizeChapterText('plugin.test', 'Novel', 'Ch 1', raw);
    expect(result).toContain('Sunny entered the stone pavilion.');
    expect(result).toContain('The shadows danced around the pillars.');
    expect(result).not.toContain('Hidden honeypot paragraph');
    expect(result).not.toContain('Zero font size trap');
    expect(result).not.toContain('Screen scraper honeypot');
  });

  it('deduplicates adjacent clone paragraphs (fixes TTS double-reading)', () => {
    const raw = `
      <p>He drew his blade quietly from the sheath.</p>
      <p>He drew his blade quietly from the sheath.</p>
      <p>The monster snarled in the darkness.</p>
    `;

    const result = sanitizeChapterText('plugin.test', 'Novel', 'Ch 1', raw);
    const count = (result.match(/He drew his blade quietly/g) || []).length;
    expect(count).toBe(1);
    expect(result).toContain('The monster snarled in the darkness.');
  });

  it('unwraps fragmented spans and strips zero-width spaces for TTS', () => {
    const raw = `
      <p><span>T\u200Bh\u200Be</span> <span>flame</span> <span>b\uFEFFurned</span> <span>brightly.</span></p>
    `;

    const result = sanitizeChapterText('plugin.test', 'Novel', 'Ch 1', raw);
    expect(result).not.toContain('\u200B');
    expect(result).not.toContain('\uFEFF');
    expect(result).toContain('The flame burned brightly.');
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
