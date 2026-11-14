import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

import {
  TTS_CONTROLLER_POSITION_MESSAGE,
  normalizeTtsControllerPosition,
  withTtsControllerPosition,
} from '../ttsControllerPosition';

describe('ttsControllerPosition helpers', () => {
  describe('normalizeTtsControllerPosition', () => {
    it('passes valid fractions through', () => {
      expect(
        normalizeTtsControllerPosition({ x: 0.44727, y: 0.25171 }),
      ).toEqual({ x: 0.4473, y: 0.2517 });
    });

    it('clamps out-of-range numbers instead of rejecting them', () => {
      expect(normalizeTtsControllerPosition({ x: 2, y: -3 })).toEqual({
        x: 1,
        y: 0,
      });
    });

    it.each([
      [null],
      [undefined],
      ['left'],
      [42],
      ['0.5,0.5'],
      [[0.5, 0.5]],
      [{ x: 0.5 }],
      [{ x: NaN, y: 0 }],
      [{ x: 0.5, y: Infinity }],
      [{ x: '0.5', y: '0.5' }],
    ])('rejects %j', value => {
      expect(normalizeTtsControllerPosition(value)).toBeUndefined();
    });
  });

  describe('withTtsControllerPosition', () => {
    it('merges the position while preserving other TTS fields', () => {
      const next = withTtsControllerPosition(
        {
          theme: 'dark',
          tts: { rate: 1.5, pitch: 1 },
        } as never,
        { x: 0.5, y: 0.25 },
      );
      expect(next.tts).toEqual({
        rate: 1.5,
        pitch: 1,
        controllerPosition: { x: 0.5, y: 0.25 },
      });
      expect(next.theme).toBe('dark');
    });

    it('creates the tts object when settings have none yet', () => {
      const next = withTtsControllerPosition(undefined, { x: 0, y: 1 });
      expect(next.tts).toEqual({ controllerPosition: { x: 0, y: 1 } });
    });
  });
});

/**
 * Drives the shipped reader page (`assets/reader/js/index.js`) through the
 * relocate-then-new-chapter sequence from issue #2000: a drag must post the
 * new position for persistence, and a fresh page (a new chapter rebuilds the
 * whole DOM) must restore the saved position instead of falling back to the
 * CSS default.
 */
describe('floating TTS button position in the reader page', () => {
  const loadPage = (options?: {
    savedPosition?: unknown;
    width?: number;
    height?: number;
  }) => {
    const width = options?.width ?? 1080;
    const height = options?.height ?? 2400;
    const posted: { type: string; data?: unknown }[] = [];
    const listeners: Record<string, ((...args: never[]) => void)[]> = {};
    const rafCallbacks: (() => void)[] = [];

    const style: Record<string, string> = {};
    const collapseButton = {
      attributes: {} as Record<string, string>,
      innerHTML: '',
      setAttribute(key: string, value: string) {
        this.attributes[key] = value;
      },
    };
    // Collapsed bubble size; the harness keeps the rect in sync with style so
    // clamping behaves like the real layout.
    const controllerElement = {
      style,
      offsetWidth: 208,
      offsetHeight: 56,
      classList: { add() {}, remove() {} },
      querySelector: () => collapseButton,
      getBoundingClientRect: () => ({
        left: style.left === undefined ? 20 : parseFloat(style.left),
        top: style.top === undefined ? height / 2 : parseFloat(style.top),
        width: 208,
        height: 56,
      }),
    };

    type Descriptor = {
      __el: true;
      tag: string;
      props: Record<string, unknown>;
      children: unknown[];
    };
    const descriptors: Descriptor[] = [];
    const makeTag =
      (tag: string) =>
      (...args: unknown[]): Descriptor => {
        const [first, ...rest] = args;
        const isProps =
          typeof first === 'object' &&
          first !== null &&
          !(first as Descriptor).__el &&
          !Array.isArray(first) &&
          typeof first !== 'function';
        const descriptor: Descriptor = {
          __el: true,
          tag,
          props: (isProps ? first : {}) as Record<string, unknown>,
          children: (isProps ? rest : args) as unknown[],
        };
        descriptors.push(descriptor);
        return descriptor;
      };

    const context = {
      window: {
        innerWidth: width,
        innerHeight: height,
        scrollY: 0,
        addEventListener: (type: string, cb: (...args: never[]) => void) => {
          listeners[type] ??= [];
          listeners[type].push(cb);
        },
        scrollTo() {},
      },
      document: {
        getElementById: (id: string) =>
          id === 'TTS-Controller' ? controllerElement : {},
        querySelector: () => null,
        addEventListener: (type: string, cb: (...args: never[]) => void) => {
          listeners[type] ??= [];
          listeners[type].push(cb);
        },
        elementsFromPoint: () => [],
        documentElement: { style: { setProperty() {} } },
      },
      reader: {
        post: (message: { type: string; data?: unknown }) => {
          posted.push(message);
        },
        generalSettings: {
          val: {
            TTSEnable: true,
            pageReader: false,
            verticalSeekbar: true,
            showBatteryAndTime: false,
            showScrollPercentage: true,
          },
        },
        readerSettings: {
          val: {
            tts:
              options?.savedPosition === undefined
                ? {}
                : { controllerPosition: options.savedPosition },
          },
        },
        hidden: { val: true },
        batteryLevel: { val: 0 },
        strings: { finished: '', nextChapter: '', noNextChapter: '' },
        adjacentVersion: { val: 0 },
        layoutHeight: height,
        chapterHeight: 5000,
        viewport: { setAttribute() {} },
      },
      tts: {
        readable: () => false,
        reading: false,
        started: false,
        start() {},
        pause() {},
        resume() {},
        next() {},
        previous() {},
      },
      pageReader: {
        movePage() {},
        page: { val: 0 },
        totalPages: { val: 1 },
      },
      van: {
        tags: {
          div: makeTag('div'),
          p: makeTag('p'),
          img: makeTag('img'),
          button: makeTag('button'),
          span: makeTag('span'),
        },
        state: (initial: unknown) => ({ val: initial }),
        derive: (fn: () => unknown) => ({ val: fn() }),
        add: () => {},
      },
      requestAnimationFrame: (cb: () => void) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      },
      setInterval: () => 0,
      ResizeObserver: class {
        observe() {}
        disconnect() {}
      },
      HTMLImageElement: class {},
      textToSpeechIcon: '<svg></svg>',
      minimizeIcon: '<svg></svg>',
      dragHandleIcon: '<svg></svg>',
      previousParagraphIcon: '<svg></svg>',
      resumeIcon: '<svg></svg>',
      nextParagraphIcon: '<svg></svg>',
    };

    const source = readFileSync(
      join(process.cwd(), 'assets/reader/js/index.js'),
      'utf8',
    );
    runInNewContext(source, context);
    for (const cb of rafCallbacks) {
      cb();
    }

    const controller = descriptors.find(
      descriptor => descriptor.props.id === 'TTS-Controller',
    );
    if (!controller) {
      throw new Error('TTS controller was not rendered');
    }
    const [dragHandle, collapseToggle] = controller.children as Descriptor[];
    if (dragHandle?.props.class !== 'tts-drag-handle') {
      throw new Error('TTS drag handle was not rendered');
    }

    const touch = (clientX: number, clientY: number) => ({
      changedTouches: [{ clientX, clientY }],
      preventDefault() {},
      stopPropagation() {},
    });

    return {
      posted,
      style,
      listeners,
      dragHandle: dragHandle.props as Record<string, (event: unknown) => void>,
      collapseToggleProps: (collapseToggle as Descriptor).props,
      window: context.window,
      setViewport: (nextWidth: number, nextHeight: number) => {
        context.window.innerWidth = nextWidth;
        context.window.innerHeight = nextHeight;
        for (const cb of listeners.resize ?? []) {
          cb();
        }
      },
      touch,
    };
  };

  it('posts the relocated position when the button is dragged', () => {
    const page = loadPage();
    // Grab the bubble where the CSS default puts it, then drag it elsewhere.
    page.dragHandle.ontouchstart(page.touch(30, 1210));
    page.dragHandle.ontouchmove(page.touch(400, 600));
    page.dragHandle.ontouchend(page.touch(400, 600));

    const saved = page.posted.filter(
      message => message.type === TTS_CONTROLLER_POSITION_MESSAGE,
    );
    expect(saved).toHaveLength(1);
    // Drag offset is (10, 10) with an 8px margin: left = 390 of the
    // [8, 872] range, top = 590 of the [8, 2344] range.
    expect(saved[0]?.data).toEqual({ x: 0.4463, y: 0.25 });
  });

  it('does not post when the drag handle is tapped without moving', () => {
    const page = loadPage();
    page.dragHandle.ontouchstart(page.touch(30, 1210));
    page.dragHandle.ontouchend(page.touch(30, 1210));

    expect(
      page.posted.filter(
        message => message.type === TTS_CONTROLLER_POSITION_MESSAGE,
      ),
    ).toHaveLength(0);
  });

  it('restores the saved position when a new chapter opens', () => {
    // Chapter N: relocate the button; the posted payload is what the app saves.
    const previousChapter = loadPage();
    previousChapter.dragHandle.ontouchstart(previousChapter.touch(30, 1210));
    previousChapter.dragHandle.ontouchmove(previousChapter.touch(400, 600));
    previousChapter.dragHandle.ontouchend(previousChapter.touch(400, 600));
    const saved = previousChapter.posted.find(
      message => message.type === TTS_CONTROLLER_POSITION_MESSAGE,
    )?.data;

    // Chapter N+1: a fresh DOM with the saved position in its settings.
    const nextChapter = loadPage({ savedPosition: saved });
    expect(parseFloat(nextChapter.style.left ?? '')).toBeCloseTo(390, 1);
    expect(parseFloat(nextChapter.style.top ?? '')).toBeCloseTo(590, 1);
  });

  it('falls back to the CSS default when nothing was saved', () => {
    const page = loadPage();
    expect(page.style.left).toBeUndefined();
    expect(page.style.top).toBeUndefined();
  });

  it('ignores a corrupt saved position instead of pinning the button', () => {
    const page = loadPage({ savedPosition: { x: 'far', y: null } });
    expect(page.style.left).toBeUndefined();
    expect(page.style.top).toBeUndefined();
  });

  it('clamps the restored button into a rotated viewport', () => {
    const page = loadPage({ savedPosition: { x: 0.99, y: 0.99 } });
    // Portrait 1080x2400: left = 8 + 0.99 * (1080 - 208 - 16).
    expect(parseFloat(page.style.left ?? '')).toBeCloseTo(855.44, 1);
    // Rotate to landscape: the button must move inside the new viewport.
    page.setViewport(2400, 1080);
    expect(parseFloat(page.style.left ?? '')).toBeLessThanOrEqual(
      2400 - 208 - 8,
    );
    expect(parseFloat(page.style.top ?? '')).toBeLessThanOrEqual(1080 - 56 - 8);
  });
});
