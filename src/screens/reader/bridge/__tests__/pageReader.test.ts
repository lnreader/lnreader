/**
 * pageReader bridge injection contract tests — RsvpTab.test.tsx pattern,
 * generalized to the pageReader bridge module surface.
 *
 * Contract: every bridge function returns a script that a WebView can
 * actually evaluate, and that script invokes the intended window.pageReader
 * method with the intended (sanitized) argument. Tests parse the whole
 * string, then run it against an instrumented window.pageReader exactly as
 * the WebView would.
 */

import { pageReaderMovePageScript } from '../pageReader';

const PAGE_READER_METHODS = ['movePage'] as const;

interface RunEnv {
  window: { pageReader: Record<string, (...args: unknown[]) => void> };
}

/** Parses and runs a script like the WebView would; returns invocations. */
const runScriptLikeWebView = (script: string, env: RunEnv): string[] => {
  const calls: string[] = [];
  const recording: Record<string, (...args: unknown[]) => void> = {};
  for (const method of PAGE_READER_METHODS) {
    recording[method] = (...args: unknown[]) =>
      calls.push(`${method}(${args.join(', ')})`);
  }
  const resolved: Record<string, unknown> = {
    window: { ...env.window, pageReader: recording },
  };
  const evaluate = new Function('window', script);
  evaluate(resolved.window);
  return calls;
};

describe('pageReader bridge — WebView injection', () => {
  it('movePage emits an evaluable script that jumps to the requested page', () => {
    const calls = runScriptLikeWebView(pageReaderMovePageScript(0), {
      window: { pageReader: {} },
    });
    expect(calls).toEqual(['movePage(0)']);
  });

  it('sanitizes non-finite page numbers so emission always parses', () => {
    for (const invalid of [NaN, Infinity, -Infinity]) {
      const script = pageReaderMovePageScript(invalid);
      expect(() => new Function('window', script)).not.toThrow();
      expect(
        runScriptLikeWebView(script, { window: { pageReader: {} } }),
      ).toEqual(['movePage(0)']);
    }
  });

  it('sanitizes fractional page numbers to integers', () => {
    expect(
      runScriptLikeWebView(pageReaderMovePageScript(2.6), {
        window: { pageReader: {} },
      }),
    ).toEqual(['movePage(3)']);
  });
});
