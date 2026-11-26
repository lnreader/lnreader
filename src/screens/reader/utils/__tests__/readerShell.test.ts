import type { ChapterInfo, NovelInfo } from '@database/types';
import {
  ReaderShellKey,
  buildChapterPayload,
  buildSetChapterScript,
  buildShellKey,
  shouldReloadShell,
} from '../readerShell';

const chapter = {
  id: 7,
  novelId: 1,
  name: '  Chapter 7 </script> ',
  path: '/c/7',
  progress: 40,
} as ChapterInfo;
const novel = { id: 1, name: 'Novel', pluginId: 'demo' } as NovelInfo;

const plugin = {
  id: 'demo',
  site: 'https://demo.example/',
  imageRequestInit: { headers: { Referer: 'https://demo.example/' } },
};

const key = (overrides: Partial<Parameters<typeof buildShellKey>[0]> = {}) =>
  buildShellKey({
    plugin,
    isDownloaded: false,
    pluginCustomJS: false,
    readerDir: 'ltr',
    theme: { primary: '#fff' },
    customJS: '',
    customCSS: '',
    ...overrides,
  });

describe('buildChapterPayload', () => {
  it('carries the chapter and its per-chapter strings', () => {
    const payload = buildChapterPayload({
      chapter,
      novel,
      html: '<p>Body</p>',
      nextChapterScreenVisible: true,
    });

    expect(payload).toMatchObject({
      chapter,
      novel,
      html: '<p>Body</p>',
      nextChapterScreenVisible: true,
    });
    expect(payload.strings.finished).toMatch(/: Chapter 7 <\/script>$/);
    expect(payload.strings).toEqual(
      expect.objectContaining({
        noNextChapter: expect.any(String),
        removeText: expect.any(String),
        replaceText: expect.any(String),
      }),
    );
  });

  it('serialises into a script the page can run as is', () => {
    const payload = buildChapterPayload({
      chapter,
      novel,
      html: '<p>"quoted" \u2028 </script></p>',
      nextChapterScreenVisible: false,
    });
    const setChapter = jest.fn();

    new Function('window', buildSetChapterScript(payload))({
      reader: { setChapter },
    });

    expect(setChapter).toHaveBeenCalledWith(
      JSON.parse(JSON.stringify(payload)),
    );
  });

  it('reports a failed swap when the page has no reader yet', () => {
    const postMessage = jest.fn();
    const payload = buildChapterPayload({
      chapter,
      novel,
      html: '',
      nextChapterScreenVisible: false,
    });

    new Function('window', buildSetChapterScript(payload))({
      ReactNativeWebView: { postMessage },
    });

    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({
      type: 'chapter-swap-failed',
      chapterId: 7,
    });
  });
});

describe('shouldReloadShell', () => {
  const ready = { shellReady: true };

  it('swaps the chapter when nothing the page was built from changed', () => {
    expect(shouldReloadShell(key(), key(), ready)).toBe(false);
  });

  it('reloads the first time and while the page is still loading', () => {
    expect(shouldReloadShell(undefined, key(), ready)).toBe(true);
    expect(shouldReloadShell(key(), key(), { shellReady: false })).toBe(true);
  });

  it('always reloads for plugins that ship custom.js', () => {
    const withScript = key({ pluginCustomJS: true });
    expect(shouldReloadShell(withScript, withScript, ready)).toBe(true);
    expect(shouldReloadShell(withScript, key(), ready)).toBe(true);
  });

  it('reloads when the downloaded state changes the document base URL', () => {
    expect(shouldReloadShell(key(), key({ isDownloaded: true }), ready)).toBe(
      true,
    );
    expect(
      shouldReloadShell(
        key({ isDownloaded: true }),
        key({ isDownloaded: true }),
        ready,
      ),
    ).toBe(false);
  });

  it.each<[string, Partial<Parameters<typeof buildShellKey>[0]>]>([
    ['plugin', { plugin: { ...plugin, id: 'other' } }],
    [
      'request headers',
      { plugin: { ...plugin, imageRequestInit: { headers: { A: 'b' } } } },
    ],
    ['reading direction', { readerDir: 'rtl' }],
    ['app theme', { theme: { primary: '#000' } }],
    ['user custom JS', { customJS: 'html = html;' }],
    ['user custom CSS', { customCSS: 'p { color: red }' }],
  ])('reloads when the %s changes', (_, overrides) => {
    expect(shouldReloadShell(key(), key(overrides), ready)).toBe(true);
  });

  it('compares keys by value, not identity', () => {
    const a: ReaderShellKey = key({ theme: { primary: '#fff' } });
    const b: ReaderShellKey = key({ theme: { primary: '#fff' } });
    expect(shouldReloadShell(a, b, ready)).toBe(false);
  });
});
