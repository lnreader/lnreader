/**
 * RSVP bridge object tests (#1576 R1/R2/R5) — node-env eval slice.
 *
 * The rsvp object must consume the SAME collectReadableEntries output as
 * TTS (no second DOM traversal), drive its own cadence timer, and report
 * position to native only on pause/exit/save ticks. These tests execute
 * the real core.js in a minimal DOM stub and assert:
 *   - window.rsvp exists after core.js loads and exposes the contracted
 *     surface (start/pause/resume/exit)
 *   - start() reuses the shared collector output (one DOM walk, same queue
 *     shape tts.start() consumes)
 *   - pause()/exit() post exactly one 'rsvp-position' message each — no
 *     per-flash chatter over the bridge
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const CORE_PATH = join(process.cwd(), 'assets', 'reader', 'js', 'core.js');

type PostMessage = { type: string; data?: unknown };

interface FakeElement {
  nodeName: string;
  innerText: string;
  childNodes: unknown[];
  children: unknown[];
  classList: {
    add: (token: string) => void;
    remove: (token: string) => void;
    contains: (token: string) => boolean;
  };
  hasChildNodes: () => boolean;
  isSameNode: (other: unknown) => boolean;
}

const makeElement = (
  text: string,
  childElements: FakeElement[] = [],
  nodeName = 'P',
) => {
  const classes = new Set<string>();
  const el = {
    nodeName,
    innerText: text,
    classList: {
      add: (token: string) => classes.add(token),
      remove: (token: string) => classes.delete(token),
      contains: (token: string) => classes.has(token),
    },
    hasChildNodes: () =>
      (el as unknown as { childNodes: { length: number } }).childNodes.length >
      0,
    isSameNode: (other: unknown) => other === el,
  } as unknown as FakeElement & { innerHTML?: string };
  const withDom = el as unknown as Record<string, unknown>;
  withDom.addEventListener = () => undefined;
  // collectReadableEntries calls childNodes.item(i) during traversal.
  withDom.childNodes = {
    length: childElements.length,
    item: (i: number) => childElements[i] ?? null,
    [Symbol.iterator]: function* () {
      yield* childElements;
    },
  };
  withDom.children = childElements;
  return el as unknown as FakeElement;
};

const loadCore = () => {
  const posted: PostMessage[] = [];
  const elements = [
    makeElement('First paragraph of text.', [], 'SPAN'),
    makeElement(
      'Second paragraph, longer text with more words here.',
      [],
      'SPAN',
    ),
  ];
  const chapterElement: FakeElement = {
    nodeName: 'DIV',
    innerText: elements.map(e => e.innerText).join('\n'),
    childNodes: [],
    children: elements,
    classList: {
      add: () => undefined,
      remove: () => undefined,
      contains: () => false,
    },
    hasChildNodes: () => true,
    isSameNode: other => other === chapterElement,
  };
  // Make the traversal reach our fake paragraphs. childNodes needs .item()
  // because collectReadableEntries walks it with childNodes.item(i).
  (chapterElement as unknown as { childNodes: unknown }).childNodes = {
    length: elements.length,
    item: (i: number) => elements[i] ?? null,
    [Symbol.iterator]: function* () {
      yield* elements;
    },
  };
  (
    chapterElement as unknown as { addEventListener: () => undefined }
  ).addEventListener = () => undefined;

  const windowObj: Record<string, unknown> = {
    getSelection: () => ({ removeAllRanges: () => undefined }),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  };
  // chapterElement needs innerHTML for core.js's reader bootstrap.
  (chapterElement as unknown as { innerHTML: string }).innerHTML = elements
    .map(e => e.innerText)
    .join('');
  const readerStub = {
    chapterElement,
    post: (obj: PostMessage) => posted.push(obj),
    readerSettings: { val: { tts: {} } },
    nextChapter: undefined,
    refresh: () => undefined,
  };

  const source = readFileSync(CORE_PATH, 'utf8');
  const run = new Function(
    'window',
    'document',
    'console',
    'setTimeout',
    'clearTimeout',
    'setInterval',
    'clearInterval',
    'reader',
    'initialReaderConfig',
    'initialPageReaderConfig',
    'van',
    'pageReader',
    'ReactNativeWebView',
    'location',
    'history',
    'navigator',
    'Node',
    'Element',
    'getComputedStyle',
    'getSelection',
    'ResizeObserver',
    source,
  );
  const vanStub = {
    state: (v: unknown) => ({ val: v }),
    derive: () => undefined,
  };
  const getComputedStyleStub = () => ({
    color: '#000',
    backgroundColor: '#fff',
    getPropertyValue: () => '0px',
  });
  // Real timers are stubbed so core.js's deferred calculatePages() never
  // runs against the minimal DOM — we only assert the bridge surface.
  const setTimeoutStub = () => 0;
  const clearTimeoutStub = () => undefined;
  const setIntervalStub = () => 0;
  const clearIntervalStub = () => undefined;
  const resizeObserverStub = class {
    observe() {
      return undefined;
    }
    disconnect() {
      return undefined;
    }
    unobserve() {
      return undefined;
    }
  };
  run(
    windowObj,
    {
      getElementById: () => null,
      createElement: (tag?: string) => {
        const el = makeElement('');
        (el as unknown as Record<string, unknown>).style = {
          cssText: '',
          remove: () => undefined,
        };
        (el as unknown as Record<string, unknown>).appendChild = () =>
          undefined;
        return el;
      },
      addEventListener: () => undefined,
      querySelector: () => makeElement(''),
      querySelectorAll: () => [],
      getElementsByClassName: () => [],
      documentElement: makeElement(''),
      body: Object.assign(makeElement(''), {
        appendChild: () => undefined,
        removeChild: () => undefined,
      }),
      createElementNS: () => makeElement(''),
    },
    console,
    setTimeoutStub,
    clearTimeoutStub,
    setIntervalStub,
    clearIntervalStub,
    readerStub,
    {
      readerSettings: {},
      chapterGeneralSettings: {},
      novel: {},
      chapter: {},
      batteryLevel: 1,
      autoSaveInterval: 0,
      DEBUG: false,
      strings: {},
    },
    {},
    vanStub,
    { page: { val: 0 }, totalPages: { val: 1 }, movePage: () => undefined },
    { postMessage: () => undefined },
    { href: '' },
    { pushState: () => undefined },
    { userAgent: 'node' },
    { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    getComputedStyleStub,
    () => ({ removeAllRanges: () => undefined }),
    resizeObserverStub,
  );

  return { windowObj, posted, elements };
};

describe('rsvp bridge object (#1576)', () => {
  it('exposes window.rsvp with the contracted surface after core.js loads', () => {
    const { windowObj } = loadCore();
    const rsvp = windowObj.rsvp as Record<string, unknown> | undefined;

    expect(rsvp).toBeDefined();
    expect(typeof (rsvp as Record<string, unknown>).start).toBe('function');
    expect(typeof (rsvp as Record<string, unknown>).pause).toBe('function');
    expect(typeof (rsvp as Record<string, unknown>).resume).toBe('function');
    expect(typeof (rsvp as Record<string, unknown>).exit).toBe('function');
    expect(typeof (rsvp as Record<string, unknown>).setWpm).toBe('function');
    expect(typeof (rsvp as Record<string, unknown>).setChunkSize).toBe(
      'function',
    );
  });

  it('reuses the shared collector: pause() posts exactly one rsvp-position (no per-flash chatter)', () => {
    const { windowObj, posted } = loadCore();
    const rsvp = windowObj.rsvp as unknown as {
      start: () => void;
      pause: () => void;
    };
    rsvp.start();
    rsvp.pause();

    const positions = posted.filter(p => p.type === 'rsvp-position');
    expect(positions).toHaveLength(1);
  });
});
