/**
 * Reader-state bridge injection contract tests — RsvpTab.test.tsx pattern,
 * generalized to the bridge module surface.
 *
 * Contract: every bridge function returns a script that a WebView can
 * actually evaluate, and that script sets exactly the intended state on the
 * instrumented window.reader / window.readerSearch, or calls the intended
 * window.reader method. Scripts reference bare globals (reader.*) exactly as
 * WebViewReader emitted them before this module existed, so the harness
 * passes those globals in as parameters the way the browser global scope
 * would resolve them.
 */

import {
  readerSetAdjacentChaptersScript,
  readerSetBatteryLevelGuardedScript,
  readerSetBatteryLevelScript,
  readerSetGeneralSettingsScript,
  readerSetSettingsScript,
} from '../reader';
import { readerSearchScript } from '../search';

/** Records `val` writes with the exact JSON the WebView state would hold. */
const makeStateSlot = (calls: string[], label: string) => {
  let current: unknown;
  return {
    get val() {
      return current;
    },
    set val(value: unknown) {
      current = value;
      calls.push(`${label}=${JSON.stringify(value)}`);
    },
  };
};

interface RunEnv {
  reader?: {
    readerSettings?: { val: unknown };
    generalSettings?: { val: unknown };
    batteryLevel?: { val: unknown };
  };
  readerSearch?: Record<string, (...args: unknown[]) => void>;
  adjacentChapters?: (payload: unknown) => void;
}

interface RunResult {
  calls: string[];
  windowStub: Record<string, unknown>;
}

/** Parses and runs a script like a WebView would; returns captured writes. */
const runScriptLikeWebView = (script: string, env: RunEnv): RunResult => {
  const calls: string[] = [];
  const reader = {
    readerSettings: makeStateSlot(calls, 'readerSettings'),
    generalSettings: makeStateSlot(calls, 'generalSettings'),
    batteryLevel: makeStateSlot(calls, 'batteryLevel'),
    ...(env.reader ?? {}),
  };
  const windowStub: Record<string, unknown> = {
    reader,
    readerSearch: env.readerSearch ?? {},
  };
  if (env.adjacentChapters) {
    (windowStub.reader as Record<string, unknown>).setAdjacentChapters =
      env.adjacentChapters;
  }
  const evaluate = new Function('window', 'reader', script);
  evaluate(windowStub, reader);
  return { calls, windowStub };
};

const MINIMAL_READER_SETTINGS = {
  theme: '#000000',
  padding: 12,
  textSize: 18,
  textColor: '#ffffff',
  textAlign: 'left',
  lineHeight: 1.5,
  fontFamily: 'default',
  tts: { rate: 1 },
};

describe('reader bridge — WebView injection', () => {
  it('setSettings emits a script that replaces reader.readerSettings.val', () => {
    const { calls } = runScriptLikeWebView(
      readerSetSettingsScript(MINIMAL_READER_SETTINGS as never),
      {},
    );
    expect(calls).toEqual([
      'readerSettings={"theme":"#000000","padding":12,"textSize":18,"textColor":"#ffffff","textAlign":"left","lineHeight":1.5,"fontFamily":"default","tts":{"rate":1}}',
    ]);
  });

  it('setSettings serializes settings with quotes without breaking the script', () => {
    const settings = { fontFamily: 'Fraunces" <- injected' };
    const { calls } = runScriptLikeWebView(
      readerSetSettingsScript(settings as never),
      {},
    );
    expect(calls).toEqual([
      'readerSettings={"fontFamily":"Fraunces\\" <- injected"}',
    ]);
    // The emission itself must parse: JSON.stringify leaves no raw quote in
    // the string literal context.
    expect(
      () =>
        new Function(
          'window',
          'reader',
          readerSetSettingsScript(settings as never),
        ),
    ).not.toThrow();
  });

  it('setGeneralSettings emits a script that replaces reader.generalSettings.val', () => {
    const { calls } = runScriptLikeWebView(
      readerSetGeneralSettingsScript({ pageReader: true } as never),
      {},
    );
    expect(calls).toEqual(['generalSettings={"pageReader":true}']);
  });

  it('setBatteryLevel emits a script that sets reader.batteryLevel.val', () => {
    const { calls } = runScriptLikeWebView(readerSetBatteryLevelScript(87), {});
    expect(calls).toEqual(['batteryLevel=87']);
  });

  it('guarded battery script no-ops before window.reader boots', () => {
    const script = readerSetBatteryLevelGuardedScript(87);
    // The guard renders `window.reader?.batteryLevel` then writes to it; with
    // a window stub lacking reader the script must neither throw nor write.
    const evaluate = new Function('window', script);
    expect(() => evaluate({})).not.toThrow();
  });

  it('guarded battery script works once window.reader.batteryLevel exists', () => {
    const script = readerSetBatteryLevelGuardedScript(72);
    const batteryLevel = { val: 0 };
    const evaluate = new Function('window', script);
    evaluate({ reader: { batteryLevel } });
    expect(batteryLevel.val).toBe(72);
  });

  it('setAdjacentChapters emits a script that hands next/prev + strings to window.reader', () => {
    let received: unknown;
    const script = readerSetAdjacentChaptersScript(
      { id: 7, name: 'Next Chapter' } as never,
      { id: 6, name: 'Prev Chapter' } as never,
      { nextChapter: 'Next Chapter' },
    );
    // parse like a WebView would and execute against an instrumented stub
    const evaluate = new Function('window', 'reader', script);
    evaluate(
      {
        reader: {
          setAdjacentChapters: (payload: unknown) => {
            received = payload;
          },
        },
      },
      {},
    );
    const payload = received as {
      nextChapter?: { id: number; name: string };
      prevChapter?: { id: number; name: string };
      strings?: { nextChapter: string };
    };
    expect(payload.nextChapter).toEqual({ id: 7, name: 'Next Chapter' });
    expect(payload.prevChapter).toEqual({ id: 6, name: 'Prev Chapter' });
    expect(payload.strings).toEqual({ nextChapter: 'Next Chapter' });
  });

  it('setAdjacentChapters tolerates missing chapters', () => {
    let received: unknown;
    const evaluate = new Function(
      'window',
      'reader',
      readerSetAdjacentChaptersScript(undefined, undefined, {
        nextChapter: '',
      }),
    );
    evaluate(
      {
        reader: {
          setAdjacentChapters: (payload: unknown) => {
            received = payload;
          },
        },
      },
      {},
    );
    const payload = received as {
      nextChapter?: unknown;
      prevChapter?: unknown;
    };
    expect(payload.nextChapter).toBeUndefined();
    expect(payload.prevChapter).toBeUndefined();
  });
});

describe('search bridge — WebView injection', () => {
  it('search emits a script that searches the page with the given query', () => {
    const captured: string[] = [];
    const evaluate = new Function('window', readerSearchScript('The Great'));
    evaluate({
      readerSearch: { search: (query: string) => captured.push(query) },
    });
    expect(captured).toEqual(['The Great']);
  });

  it('search JSON-escapes tricky queries', () => {
    const captured: string[] = [];
    const evaluate = new Function(
      'window',
      readerSearchScript('say "hi" \\ backslash'),
    );
    evaluate({
      readerSearch: { search: (query: string) => captured.push(query) },
    });
    expect(captured).toEqual(['say "hi" \\ backslash']);
    expect(
      () => new Function('window', readerSearchScript('say "hi" \\ backslash')),
    ).not.toThrow();
  });
});
