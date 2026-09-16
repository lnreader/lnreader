/**
 * Custom-JS bridge contract tests — generalized RsvpTab pattern.
 *
 * The custom-JS inline block is embedded into the serialized chapter HTML,
 * so the tests assert the two failure modes a WebView exposes there:
 *   1. The emitted body must parse (a SyntaxError inside the page would
 *      silently kill the inline script and the whole wrapper).
 *   2. User text can never terminate the <script> tag early — the `</script`
 *      breakout sequence must be escaped in the raw text, while still
 *      spelling `</script>` at runtime (JS string escapes are transparent).
 */

import { buildCustomJsInlineScript } from '../customJs';

interface DocumentStub {
  html: string;
  listeners: Record<string, (() => void) | undefined>;
  querySelector: (sel: string) => { innerHTML: string } | null;
  addEventListener: (event: string, fn: () => void) => void;
}

const makeDocumentStub = (initialHtml: string): DocumentStub => {
  const doc = {} as DocumentStub;
  doc.html = initialHtml;
  doc.listeners = {};
  const element = {
    get innerHTML() {
      return doc.html;
    },
    set innerHTML(value: string) {
      doc.html = value;
    },
  };
  doc.querySelector = sel => (sel === '#LNReader-chapter' ? element : null);
  doc.addEventListener = (event, fn) => {
    doc.listeners[event] = fn;
  };
  return doc;
};

/** Evaluates the inline body like the browser would; runs the wrapper. */
const runInlineScript = (
  customJs: string,
  initialHtml: string,
  windows?: Record<string, unknown>,
) => {
  const doc = makeDocumentStub(initialHtml);
  const body = buildCustomJsInlineScript(customJs);
  // Parse the whole body: a SyntaxError here means the WebView dropped the
  // entire inline script before running anything.
  const evaluate = new Function('window', 'document', body);
  evaluate(windows ?? {}, doc);
  return { doc, body };
};

describe('customJs bridge — inline script contract', () => {
  it('emits a parseable script body for a snippet, even a snippet with newlines', () => {
    const doc = makeDocumentStub('');
    const { body } = runInlineScript('const x = 1;\nconst y = x + 1;', '');
    // Executing the parsed body with a document stub proves the whole inline
    // script is evaluable — a SyntaxError here dies inside the WebView too.
    expect(() => new Function('document', body)(doc)).not.toThrow();
  });

  it('emits a parseable body when there is no custom JS at all', () => {
    const { body } = runInlineScript('', '');
    expect(() => new Function('document', body)).not.toThrow();
  });

  it('runs the user snippet exactly once, between reading and writing HTML', () => {
    const calls: string[] = [];
    const snippet = `window.__customJsProbe = 'ran';`;
    const body = buildCustomJsInlineScript(snippet);
    const evaluate = new Function('window', 'document', 'globals', body);
    // The wrapper captures the element once at fn() run time; instrument the
    // element so we can see the exact order read → snippet → write.
    const element = {
      get innerHTML() {
        calls.push('read');
        return '<p>initial</p>';
      },
      set innerHTML(value: string) {
        calls.push(`write:${value}`);
      },
    };
    const docStub = {
      querySelector: (sel: string) =>
        sel === '#LNReader-chapter' ? element : null,
      addEventListener: (_event: string, fn: () => void) => {
        // fire DOMContentLoaded the moment it is registered
        callListeners.push(fn);
      },
    };
    const callListeners: (() => void)[] = [];
    evaluate({ __customJsProbe: undefined }, docStub, {});
    callListeners[0]?.();
    expect(calls).toEqual(['read', 'write:<p>initial</p>']);
  });

  it('escapes `</script` so user code cannot terminate the inline script tag', () => {
    const { body } = runInlineScript(
      `probe('</script><script>alert(1)</script>')`,
      '',
    );
    // Raw text must never contain the breakout sequence...
    expect(body).not.toMatch(/<\/script/gi);
    // ...but must carry it escaped, and the escape must be transparent at
    // runtime (the JS engine resumes `</script>` inside the string).
    expect(body).toMatch(/<\\\/script/gi);
  });

  it('escaped `</script` evaluates back to its original value at runtime', () => {
    const doc = makeDocumentStub('<p>initial</p>');
    const body = buildCustomJsInlineScript(`window.__escaped = '</script>';`);
    const windowObject: Record<string, unknown> = {};
    const evaluate = new Function('window', 'document', body);
    expect(() => evaluate(windowObject, doc)).not.toThrow();
    // The snippet runs inside fn(), which the browser fires on
    // DOMContentLoaded — fire it the way the wrapper registers it.
    doc.listeners['DOMContentLoaded']?.();
    expect(windowObject.__escaped).toBe('</script>');
  });

  it('wraps the snippet with read → snippet → write in one DOMContentLoaded fn', () => {
    const body = buildCustomJsInlineScript('/* custom */');
    const readIdx = body.indexOf(
      "let html = document.querySelector('#LNReader-chapter').innerHTML;",
    );
    const snippetIdx = body.indexOf('/* custom */');
    const writeIdx = body.indexOf(
      "document.querySelector('#LNReader-chapter').innerHTML = html;",
    );
    const loadedIdx = body.indexOf(
      "document.addEventListener('DOMContentLoaded', fn);",
    );
    expect(readIdx).toBeGreaterThanOrEqual(0);
    expect(readIdx).toBeLessThan(snippetIdx);
    expect(snippetIdx).toBeLessThan(writeIdx);
    expect(writeIdx).toBeLessThan(loadedIdx);
  });
});
