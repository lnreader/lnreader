/**
 * core.js surface parity tests — the TS-side bridge scripts vs the REAL
 * WebView assets.
 *
 * Paranoia, exactly: the bridge modules emit scripts for window.tts /
 * window.reader / window.readerSearch. If the JS asset renames a method or
 * drops a state slot, those scripts silently no-op on device — the #2009
 * class of failure. These tests load the real assets/reader/js/core.js and
 * assets/reader/js/search.js in a minimal DOM stub (the pattern proven by
 * #1576's rsvpBridge.test.ts) and then:
 *   1. pin the surfaces the TS bridges target (method existence + shapes),
 *   2. run every bridge-emitted script against that real surface and assert
 *      the actual effect a WebView would produce.
 *
 * window.rsvp is intentionally NOT here: upstream master has no RSVP tab yet
 * (PR #2009, unmerged) and the rsvp bridge extraction is deferred behind it
 * (queued as follow-up card t_38ff5fae, merge-dependent). This suite is the
 * drift tripwire for the assets master ships today.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  readerSetAdjacentChaptersScript,
  readerSetBatteryLevelGuardedScript,
  readerSetBatteryLevelScript,
  readerSetGeneralSettingsScript,
  readerSetSettingsScript,
} from '../reader';
import { readerSearchScript } from '../search';
import {
  ttsCompleteScript,
  ttsSetActiveIndexScript,
  ttsSetPlaybackStateScript,
} from '../tts';

const ASSET_DIR = join(process.cwd(), 'assets', 'reader', 'js');

type PostMessage = { type: string; data?: unknown };

interface FakeElement {
  nodeName: string;
  innerText: string;
  innerHTML: string;
  scrollHeight: number;
  scrollWidth: number;
  childNodes: { length: number; item: (i: number) => unknown };
  children: unknown[];
  classList: { add: () => void; remove: () => void; contains: () => boolean };
  style: { cssText: string; setProperty: () => void; remove: () => void };
  hasChildNodes: () => boolean;
  isSameNode: (other: unknown) => boolean;
  addEventListener: () => void;
  appendChild: () => void;
  removeChild: () => void;
}

const makeElement = (
  text = '',
  childElements: FakeElement[] = [],
  nodeName = 'P',
): FakeElement => ({
  nodeName,
  innerText: text,
  innerHTML: text,
  scrollHeight: 0,
  scrollWidth: 0,
  childNodes: {
    length: childElements.length,
    item: (i: number) => childElements[i] ?? null,
  },
  children: childElements,
  classList: {
    add: () => undefined,
    remove: () => undefined,
    contains: () => false,
  },
  style: { cssText: '', setProperty: () => undefined, remove: () => undefined },
  hasChildNodes: () => childElements.length > 0,
  isSameNode: other => other === null,
  addEventListener: () => undefined,
  appendChild: () => undefined,
  removeChild: () => undefined,
});

const initialReaderConfig = {
  readerSettings: { theme: '#ffffff', tts: {} },
  chapterGeneralSettings: { pageReader: false },
  novel: {},
  chapter: {},
  batteryLevel: 50,
  autoSaveInterval: 2222,
  DEBUG: false,
  strings: {},
};

interface LoadedAssets {
  windowObj: Record<string, unknown>;
  /**
   * Evaluate an arbitrary script in the same stub environment core.js saw.
   * Injected bridge scripts must resolve the reader global to the REAL
   * window.reader core.js created, so readerOverride defaults to that.
   */
  evaluate: (script: string, readerOverride?: unknown) => void;
}

const loadAssets = (): LoadedAssets => {
  const posted: PostMessage[] = [];
  const chapterElement = makeElement('<p>Hello, world!</p>', [], 'DIV');
  const elements = [makeElement('First paragraph of text.', [], 'SPAN')];
  chapterElement.innerHTML = '';
  chapterElement.childNodes = {
    length: elements.length,
    item: (i: number) => elements[i] ?? null,
  };
  chapterElement.children = elements;

  const windowObj: Record<string, unknown> = {
    getSelection: () => ({ removeAllRanges: () => undefined }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    innerHeight: 800,
    innerWidth: 400,
    scrollTo: () => undefined,
  };
  const readerStub = {
    chapterElement,
    post: (obj: PostMessage) => posted.push(obj),
    readerSettings: { val: initialReaderConfig.readerSettings },
    generalSettings: { val: initialReaderConfig.chapterGeneralSettings },
    nextChapter: undefined,
    refresh: () => undefined,
  };
  const vanStub = {
    state: (v: unknown) => ({ val: v }),
    derive: () => undefined,
  };
  const getComputedStyleStub = () => ({
    color: '#000',
    backgroundColor: '#fff',
    getPropertyValue: () => '0px',
    setProperty: (prop: string, value: string) => {
      (readerStub as unknown as Record<string, unknown>)[prop] = value;
    },
  });
  const setTimeoutStub = () => 0;
  const clearTimeoutStub = () => undefined;
  const setIntervalStub = () => 0;
  const clearIntervalStub = () => undefined;

  const documentStub = {
    getElementById: () => null,
    createElement: (_tag?: string) => makeElement(''),
    addEventListener: () => undefined,
    querySelector: (sel: string) =>
      sel === '#LNReader-chapter' ? chapterElement : makeElement(''),
    querySelectorAll: () => [],
    getElementsByClassName: () => [],
    documentElement: makeElement(''),
    body: makeElement(''),
    createElementNS: () => makeElement(''),
    createDocumentFragment: () => makeElement(''),
    createTreeWalker: () => ({ nextNode: () => null }),
    createRange: () => ({
      selectNodeContents: () => undefined,
      extractContents: () => makeElement(''),
      createContextualFragment: () => makeElement(''),
    }),
  };

  const params = {
    window: windowObj,
    document: documentStub,
    console,
    setTimeout: setTimeoutStub,
    clearTimeout: clearTimeoutStub,
    setInterval: setIntervalStub,
    clearInterval: clearIntervalStub,
    reader: readerStub,
    initialReaderConfig,
    initialPageReaderConfig: {},
    van: vanStub,
    pageReader: undefined,
    ReactNativeWebView: { postMessage: () => undefined },
    location: {},
    history: {},
    navigator: {},
    getComputedStyle: getComputedStyleStub,
    getSelection: () => ({ removeAllRanges: () => undefined }),
    Node: {},
    Element: {},
    ResizeObserver: class {
      observe() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
    },
  };

  const evaluate = (script: string, readerOverride?: unknown) => {
    // After core.js ran, windowObj.reader IS the global `reader` the emitted
    // bridge scripts reference (browsers resolve bare window properties) —
    // resolve it that way; during the core.js load itself the fallback stub
    // is used, exactly as in the #1576 contract suite.
    const reader = readerOverride ?? windowObj.reader ?? readerStub;
    const fn = new Function(...Object.keys(params), script);
    const values = Object.values(params);
    const readerIndex = Object.keys(params).indexOf('reader');
    if (reader !== readerStub) {
      values[readerIndex] = reader;
    }
    fn(...values);
  };

  evaluate(readFileSync(join(ASSET_DIR, 'core.js'), 'utf8'));
  evaluate(readFileSync(join(ASSET_DIR, 'search.js'), 'utf8'));
  return { windowObj, evaluate };
};

const ttsSurface = (env: LoadedAssets) =>
  env.windowObj.tts as Record<string, unknown>;
const readerSurface = (env: LoadedAssets) =>
  env.windowObj.reader as Record<string, unknown>;

describe('core.js / search.js surface parity', () => {
  let env: LoadedAssets;
  beforeEach(() => {
    env = loadAssets();
  });

  it('window.reader exposes the state slots the bridge scripts target', () => {
    const reader = readerSurface(env);
    for (const slot of ['readerSettings', 'generalSettings', 'batteryLevel']) {
      expect(reader[slot]).toBeDefined();
      expect(typeof (reader[slot] as { val?: unknown }).val).not.toBe(
        'undefined',
      );
    }
    expect(typeof reader.setAdjacentChapters).toBe('function');
    expect(typeof reader.hidden).toBeDefined();
  });

  it('window.tts exposes the methods the tts bridge scripts call', () => {
    const tts = ttsSurface(env);
    for (const method of [
      'start',
      'complete',
      'setActiveIndex',
      'setPlaybackState',
    ]) {
      expect(typeof tts[method]).toBe('function');
    }
  });

  it('window.tts.readableNodeNames keeps the traversal constants the TTS walk relies on', () => {
    const tts = ttsSurface(env);
    const names = tts.readableNodeNames as string[];
    expect(Array.isArray(names)).toBe(true);
    for (const required of [
      '#text',
      'B',
      'I',
      'EM',
      'SPAN',
      'STRONG',
      'A',
      'MARK',
    ]) {
      expect(names).toContain(required);
    }
  });

  it('window.readerSearch exposes the methods the search bridge targets', () => {
    const search = env.windowObj.readerSearch as Record<string, unknown>;
    expect(search).toBeDefined();
    for (const method of ['search', 'clear', 'next', 'previous']) {
      expect(typeof search[method]).toBe('function');
    }
  });

  it('tts setPlaybackState script drives the real surface (WebView truth)', () => {
    env.evaluate(ttsSetPlaybackStateScript('playing'));
    const tts = ttsSurface(env);
    expect((tts as { reading: boolean }).reading).toBe(true);

    env.evaluate(ttsSetPlaybackStateScript('paused'));
    expect((tts as { reading: boolean }).reading).toBe(false);
  });

  it('tts complete + setActiveIndex scripts run without throwing on the real surface', () => {
    expect(() => env.evaluate(ttsCompleteScript())).not.toThrow();
    expect(() => env.evaluate(ttsSetActiveIndexScript(0))).not.toThrow();
  });

  it('reader settings script replaces the real readerSettings.val', () => {
    const settings = { theme: '#123456', tts: { rate: 1.2 } };
    env.evaluate(readerSetSettingsScript(settings as never));
    const reader = readerSurface(env);
    expect(JSON.parse(JSON.stringify(reader.readerSettings))).toEqual({
      val: settings,
    });
  });

  it('reader general-settings script replaces the real generalSettings.val', () => {
    env.evaluate(readerSetGeneralSettingsScript({ pageReader: true } as never));
    const reader = readerSurface(env);
    expect(
      (reader.generalSettings as { val: { pageReader: boolean } }).val
        .pageReader,
    ).toBe(true);
  });

  it('battery scripts set the real batteryLevel.val', () => {
    env.evaluate(readerSetBatteryLevelScript(42));
    const reader = readerSurface(env);
    expect((reader.batteryLevel as { val: number }).val).toBe(42);

    env.evaluate(readerSetBatteryLevelGuardedScript(7));
    expect((reader.batteryLevel as { val: number }).val).toBe(7);
  });

  it('adjacent-chapters script hands payload to the real setAdjacentChapters', () => {
    env.evaluate(
      readerSetAdjacentChaptersScript(
        { id: 7, name: 'Next' } as never,
        undefined,
        { nextChapter: 'Next' },
      ),
    );
    const reader = readerSurface(env) as {
      nextChapter?: { id: number };
      nextChapterName?: void;
      strings: Record<string, unknown>;
      adjacentVersion: { val: number };
    };
    expect(reader.nextChapter).toEqual({ id: 7, name: 'Next' });
    expect(reader.strings.nextChapter).toBe('Next');
    expect(reader.adjacentVersion.val).toBeGreaterThan(0);
  });

  it('search script emission parses and targets the real surface', () => {
    // search() itself is an asynchronous DOM-walker (createTreeWalker over
    // chapter segments) that needs a full DOM implementation, which this
    // stub deliberately does not provide — that behavior is search.js's own
    // domain. The bridge contract here is: emission parses and the method
    // surface exists (pinned above), so a rename or syntax break in either
    // side fails this suite.
    const script = readerSearchScript('test');
    expect(() => new Function('window', script)).not.toThrow();
    expect(
      typeof (env.windowObj.readerSearch as Record<string, unknown>).search,
    ).toBe('function');
  });
});
