import { JSDOM } from 'jsdom';

import {
  buildEpubLNReaderApiScript,
  buildLNReaderApiScript,
  CHAPTER_ELEMENT_ID,
  serializeForInlineScript,
  wrapCustomizationScript,
  type ReaderCustomizationContext,
} from '../readerCustomization';

const createDom = (chapterHtml = '<p>Hello</p>') =>
  new JSDOM(
    `<!doctype html><html><body><div id="${CHAPTER_ELEMENT_ID}">${chapterHtml}</div></body></html>`,
    { runScripts: 'dangerously' },
  );

/**
 * Executes `script` against the jsdom window as a real global object (via
 * `runScripts: 'dangerously'`), so bare identifiers like `LNReader` and
 * `document` resolve exactly as they would in an injected WebView
 * <script> tag - unlike `new Function(...)`, which only sees `window` as a
 * local parameter.
 */
const runInDom = (dom: JSDOM, script: string) => {
  dom.window.eval(script);
};

const baseContext: ReaderCustomizationContext = {
  sourceId: 'demo-source',
  novelId: 42,
  novelName: 'Demo Novel',
  chapterId: 7,
  chapterName: 'Chapter One',
};

describe('serializeForInlineScript', () => {
  it('serializes undefined as the bare literal', () => {
    expect(serializeForInlineScript(undefined)).toBe('undefined');
  });

  it('escapes </script> so it cannot terminate the enclosing script tag', () => {
    const serialized = serializeForInlineScript('</script><script>evil()');
    expect(serialized.toLowerCase()).not.toContain('</script');
  });

  it('round-trips quotes and closing script tags through eval', () => {
    const value = `Novel "Two" </script><script>alert(1)</script>`;
    const serialized = serializeForInlineScript(value);
    expect(eval(serialized)).toBe(value);
  });
});

describe('buildLNReaderApiScript - advertised variables', () => {
  it('exposes all six backward-compatible variables with the right values', () => {
    const dom = createDom();
    const script =
      buildLNReaderApiScript(baseContext) +
      '\nwindow.__captured = { sourceId, novelId, novelName, chapterId, chapterName, html };';

    runInDom(dom, script);

    const captured = (dom.window as unknown as { __captured: unknown })
      .__captured;
    expect(captured).toEqual({
      sourceId: 'demo-source',
      novelId: 42,
      novelName: 'Demo Novel',
      chapterId: 7,
      chapterName: 'Chapter One',
      html: '<p>Hello</p>',
    });
  });

  it('reads the html snapshot straight from the DOM, so downloaded and online chapters behave identically', () => {
    // The bootstrap only reads #LNReader-chapter's innerHTML - it has no
    // notion of where that HTML came from (a downloaded file vs. an online
    // fetch), so a downloaded chapter and an online chapter with the same
    // rendered content must produce the same snapshot.
    const downloaded = createDom('<p>downloaded content</p>');
    const online = createDom('<p>online content</p>');

    runInDom(
      downloaded,
      buildLNReaderApiScript(baseContext) + '\nwindow.__html = html;',
    );
    runInDom(
      online,
      buildLNReaderApiScript(baseContext) + '\nwindow.__html = html;',
    );

    expect((downloaded.window as unknown as { __html: string }).__html).toBe(
      '<p>downloaded content</p>',
    );
    expect((online.window as unknown as { __html: string }).__html).toBe(
      '<p>online content</p>',
    );
  });
});

describe('buildLNReaderApiScript - window.LNReader API', () => {
  it('builds a frozen, versioned API object', () => {
    const dom = createDom();
    runInDom(dom, buildLNReaderApiScript(baseContext));

    const LNReader = (
      dom.window as unknown as { LNReader: Record<string, unknown> }
    ).LNReader;

    expect(LNReader.apiVersion).toBe(1);
    expect(LNReader.context).toEqual(baseContext);
    expect(Object.isFrozen(LNReader)).toBe(true);
    expect(Object.isFrozen(LNReader.context)).toBe(true);
    expect(Object.isFrozen(LNReader.chapter)).toBe(true);
  });

  it('exposes chapter.root and chapter.getHTML() backed by the chapter element', () => {
    const dom = createDom('<p>Body text</p>');
    runInDom(dom, buildLNReaderApiScript(baseContext));

    const LNReader = (
      dom.window as unknown as {
        LNReader: {
          chapter: { root: Element; getHTML(): string };
        };
      }
    ).LNReader;

    expect(LNReader.chapter.root).toBe(
      dom.window.document.getElementById(CHAPTER_ELEMENT_ID),
    );
    expect(LNReader.chapter.getHTML()).toBe('<p>Body text</p>');
  });

  it('is a pure function: the live reader and the preview get identical output for the same context', () => {
    const liveReaderScript = buildLNReaderApiScript({ ...baseContext });
    const previewScript = buildLNReaderApiScript({ ...baseContext });
    expect(liveReaderScript).toBe(previewScript);
  });
});

describe('buildLNReaderApiScript - CSS hooks', () => {
  it('supports the recommended data-source-id selector and the legacy #sourceId-X selector', () => {
    const dom = createDom();
    runInDom(dom, buildLNReaderApiScript(baseContext));
    const { body } = dom.window.document;

    expect(body.id).toBe('sourceId-demo-source');
    expect(body.dataset.sourceId).toBe('demo-source');
    expect(body.dataset.novelId).toBe('42');
    expect(body.dataset.chapterId).toBe('7');
    expect(body.matches('#sourceId-demo-source')).toBe(true);
    expect(body.matches("body[data-source-id='demo-source']")).toBe(true);
  });

  it('does not match a rule scoped to a different source', () => {
    const dom = createDom();
    runInDom(dom, buildLNReaderApiScript(baseContext));
    const { body } = dom.window.document;

    expect(body.matches('#sourceId-other-source')).toBe(false);
    expect(body.matches("body[data-source-id='other-source']")).toBe(false);
  });

  it('leaves the id/dataset unset when sourceId is absent', () => {
    const dom = createDom();
    runInDom(
      dom,
      buildLNReaderApiScript({ ...baseContext, sourceId: undefined }),
    );
    const { body } = dom.window.document;

    expect(body.id).toBe('');
    expect(body.dataset.sourceId).toBeUndefined();
    expect(body.dataset.chapterId).toBe('7');
  });
});

describe('buildLNReaderApiScript - novel/chapter names with quotes', () => {
  it('handles names containing quotes and </script> without breaking the page', () => {
    const dom = createDom();
    const trickyContext: ReaderCustomizationContext = {
      ...baseContext,
      novelName: `Novel "Two" </script><script>window.__hijacked = true;</script>`,
      chapterName: `Chapter "1" </script>`,
    };
    const script = buildLNReaderApiScript(trickyContext);

    expect(script.toLowerCase()).not.toContain('</script');

    runInDom(dom, script);

    const LNReader = (
      dom.window as unknown as {
        LNReader: { context: Record<string, unknown> };
      }
    ).LNReader;
    expect(LNReader.context.novelName).toBe(trickyContext.novelName);
    expect(LNReader.context.chapterName).toBe(trickyContext.chapterName);
    expect(
      (dom.window as unknown as { __hijacked?: boolean }).__hijacked,
    ).toBeUndefined();
  });
});

describe('buildLNReaderApiScript - plugin script error reporting', () => {
  it('reports a runtime error thrown by the matching plugin script file', () => {
    const dom = createDom();
    const postMessage = jest.fn();
    (
      dom.window as unknown as {
        ReactNativeWebView: { postMessage: jest.Mock };
      }
    ).ReactNativeWebView = { postMessage };

    runInDom(
      dom,
      buildLNReaderApiScript(baseContext, {
        pluginScriptUrl: 'file:///plugin/custom.js',
      }),
    );

    dom.window.dispatchEvent(
      new dom.window.ErrorEvent('error', {
        message: 'boom',
        filename: 'file:///plugin/custom.js',
      }),
    );

    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0]);
    expect(payload).toEqual({
      type: 'customization-error',
      data: { kind: 'plugin-js', message: 'boom', stack: undefined },
    });
  });

  it('ignores errors from scripts other than the plugin script', () => {
    const dom = createDom();
    const postMessage = jest.fn();
    (
      dom.window as unknown as {
        ReactNativeWebView: { postMessage: jest.Mock };
      }
    ).ReactNativeWebView = { postMessage };

    runInDom(
      dom,
      buildLNReaderApiScript(baseContext, {
        pluginScriptUrl: 'file:///plugin/custom.js',
      }),
    );

    dom.window.dispatchEvent(
      new dom.window.ErrorEvent('error', {
        message: 'unrelated app error',
        filename: 'file:///android_asset/js/core.js',
      }),
    );

    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe('wrapCustomizationScript', () => {
  it('returns an empty string for empty/whitespace-only code', () => {
    expect(wrapCustomizationScript(undefined, 'user-js')).toBe('');
    expect(wrapCustomizationScript('   ', 'user-js')).toBe('');
  });

  it('isolates a throwing user script and reports a structured error', () => {
    const dom = createDom();
    const postMessage = jest.fn();
    (
      dom.window as unknown as {
        ReactNativeWebView: { postMessage: jest.Mock };
      }
    ).ReactNativeWebView = { postMessage };

    const script = wrapCustomizationScript(
      "throw new Error('user script exploded');",
      'user-js',
    );

    expect(() => runInDom(dom, script)).not.toThrow();
    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0]);
    expect(payload.type).toBe('customization-error');
    expect(payload.data.kind).toBe('user-js');
    expect(payload.data.message).toBe('user script exploded');
  });

  it('does not throw when there is no ReactNativeWebView bridge (e.g. an exported EPUB)', () => {
    const dom = createDom();
    const script = wrapCustomizationScript(
      "throw new Error('boom');",
      'user-js',
    );
    expect(() => runInDom(dom, script)).not.toThrow();
  });

  it('a failing plugin script does not prevent the user script from running', () => {
    const dom = createDom();
    const results: string[] = [];
    (dom.window as unknown as { record: (s: string) => void }).record = s =>
      results.push(s);

    // Simulates two independent <script> tags: the browser keeps executing
    // subsequent tags even if an earlier one throws.
    const pluginScript = "throw new Error('plugin exploded');";
    const userScript = wrapCustomizationScript(
      "record('user-ran');",
      'user-js',
    );

    expect(() => runInDom(dom, pluginScript)).toThrow();
    expect(() => runInDom(dom, userScript)).not.toThrow();
    expect(results).toEqual(['user-ran']);
  });
});

describe('buildEpubLNReaderApiScript', () => {
  it('exposes the same six variables, reading chapterId/chapterName from the per-page DOM', () => {
    const dom = createDom();
    dom.window.document.title = 'Epub Chapter Title';
    dom.window.document.body.dataset.chapterId = '99';

    const script =
      buildEpubLNReaderApiScript({
        sourceId: 'demo-source',
        novelId: 42,
        novelName: 'Demo Novel',
      }) +
      '\nwindow.__captured = { sourceId, novelId, novelName, chapterId, chapterName, html };';

    runInDom(dom, script);

    const captured = (dom.window as unknown as { __captured: unknown })
      .__captured;
    expect(captured).toEqual({
      sourceId: 'demo-source',
      novelId: 42,
      novelName: 'Demo Novel',
      chapterId: 99,
      chapterName: 'Epub Chapter Title',
      html: dom.window.document.body.innerHTML,
    });
  });

  it('supports the recommended and legacy source selectors on the exported page', () => {
    const dom = createDom();
    dom.window.document.title = 'Chapter';
    dom.window.document.body.dataset.chapterId = '1';

    runInDom(
      dom,
      buildEpubLNReaderApiScript({
        sourceId: 'demo-source',
        novelId: 1,
        novelName: 'Novel',
      }),
    );

    const { body } = dom.window.document;
    expect(body.matches('#sourceId-demo-source')).toBe(true);
    expect(body.matches("body[data-source-id='demo-source']")).toBe(true);
    expect(body.matches('#sourceId-other-source')).toBe(false);
  });
});
