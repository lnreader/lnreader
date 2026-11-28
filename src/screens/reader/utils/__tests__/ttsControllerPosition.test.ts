import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { JSDOM, VirtualConsole } from 'jsdom';

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
      ).toEqual({ x: 0.44727, y: 0.25171 });
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
      [{ x: 2, y: 0.5 }],
      [{ x: 0.5, y: -0.1 }],
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
 * Drives the shipped reader page (`assets/reader/js/index.js`) with the real
 * VanJS in jsdom. jsdom has no layout engine, so the controller's size is
 * stubbed: a narrow bubble when collapsed and a wide bar when expanded.
 */
describe('floating TTS button position in the reader page', () => {
  const [vanSource, iconsSource, indexSource] = [
    'van.js',
    'icons.js',
    'index.js',
  ].map(file =>
    readFileSync(join(process.cwd(), 'assets/reader/js', file), 'utf8'),
  );
  const closers: (() => void)[] = [];

  afterEach(() => {
    closers.splice(0).forEach(close => close());
  });

  const loadPage = async ({
    savedPosition,
    ttsEnabled = true,
  }: { savedPosition?: unknown; ttsEnabled?: boolean } = {}) => {
    const posted: { type: string; data?: unknown }[] = [];
    const errors: unknown[] = [];
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', error => errors.push(error));
    virtualConsole.on('jsdomError', error => errors.push(error));
    const dom = new JSDOM('<!DOCTYPE html><div id="reader-ui"></div>', {
      runScripts: 'outside-only',
      pretendToBeVisual: true,
      virtualConsole,
    });
    const window = dom.window as any;
    const settle = () =>
      new Promise<void>(resolve => window.setTimeout(resolve, 40));

    window.innerWidth = 400;
    window.innerHeight = 800;
    window.document.elementsFromPoint = () => [];
    window.ResizeObserver = class {
      observe() {}
    };
    const widthOf = (element: HTMLElement) =>
      element.classList.contains('collapsed') ? 50 : 320;
    Object.defineProperties(window.HTMLElement.prototype, {
      offsetWidth: {
        get() {
          return widthOf(this);
        },
      },
      offsetHeight: { get: () => 50 },
    });
    window.HTMLElement.prototype.getBoundingClientRect = function () {
      return {
        left: parseFloat(this.style.left || '20'),
        top: parseFloat(this.style.top || String(window.innerHeight / 2)),
        width: widthOf(this),
        height: 50,
      };
    };

    window.eval(vanSource);
    const { state } = window.van;
    window.reader = {
      post: (message: { type: string; data?: unknown }) => {
        posted.push(message);
      },
      generalSettings: state({ TTSEnable: ttsEnabled, verticalSeekbar: true }),
      readerSettings: state({ tts: { controllerPosition: savedPosition } }),
      hidden: state(true),
      batteryLevel: state(1),
      chapterVersion: state(0),
      adjacentVersion: state(0),
      strings: {},
    };
    window.tts = { readable: () => false, start() {} };
    window.pageReader = { page: state(0), totalPages: state(1) };
    window.eval(`${iconsSource}\n${indexSource}`);
    await settle();
    closers.push(() => {
      window.close();
      expect(errors).toEqual([]);
    });

    const find = (selector: string): HTMLElement =>
      window.document.querySelector(selector);
    const controller = find('#TTS-Controller');
    const touch = (
      target: HTMLElement,
      type: string,
      clientX: number,
      clientY: number,
    ) =>
      target.dispatchEvent(
        Object.assign(new window.Event(type), {
          changedTouches: [{ clientX, clientY }],
        }),
      );

    return {
      window,
      settle,
      position: () => ({
        left: controller.style.left,
        top: controller.style.top,
      }),
      savedPositions: () =>
        posted
          .filter(message => message.type === TTS_CONTROLLER_POSITION_MESSAGE)
          .map(message => message.data),
      dragHandle: find('.tts-drag-handle'),
      bubble: find('.tts-collapse-toggle'),
      toggle: async () => {
        find('.tts-collapse-toggle').click();
        await settle();
      },
      drag: (
        target: HTMLElement,
        from: [number, number],
        to: [number, number],
      ) => {
        touch(target, 'touchstart', ...from);
        touch(target, 'touchmove', ...to);
        touch(target, 'touchend', ...to);
      },
      touch,
    };
  };

  it('saves a collapsed drag and restores it in a newly loaded page', async () => {
    const page = await loadPage();
    page.drag(page.bubble, [30, 410], [210, 210]);

    expect(page.savedPositions()).toEqual([{ x: 0.5, y: 0.25 }]);
    const reopened = await loadPage({
      savedPosition: page.savedPositions()[0],
    });
    expect(reopened.position()).toEqual({ left: '200px', top: '200px' });
  });

  it('restores a drag-handle move at the same spot once collapsed', async () => {
    const page = await loadPage();
    await page.toggle();
    page.drag(page.dragHandle, [30, 410], [50, 210]);
    expect(page.position()).toEqual({ left: '40px', top: '200px' });

    const reopened = await loadPage({
      savedPosition: page.savedPositions()[0],
    });
    expect(reopened.position()).toEqual({ left: '40px', top: '200px' });
  });

  it('does not save when the drag handle is tapped without moving', async () => {
    const page = await loadPage();
    await page.toggle();
    page.touch(page.dragHandle, 'touchstart', 30, 410);
    page.touch(page.dragHandle, 'touchend', 30, 410);

    expect(page.savedPositions()).toEqual([]);
  });

  it('does not save when the finger jitters on the drag handle', async () => {
    const page = await loadPage({ savedPosition: { x: 0.8, y: 0.25 } });
    await page.toggle();
    page.drag(page.dragHandle, [80, 210], [81, 210]);

    expect(page.savedPositions()).toEqual([]);
    await page.toggle();
    expect(page.position()).toEqual({ left: '320px', top: '200px' });
  });

  it.each(['dragHandle', 'bubble'] as const)(
    'keeps the saved position when a %s touch is cancelled',
    async control => {
      const page = await loadPage({ savedPosition: { x: 0.1, y: 0.25 } });
      if (control === 'dragHandle') {
        await page.toggle();
      }
      page.touch(page[control], 'touchstart', 50, 210);
      page.touch(page[control], 'touchmove', 60, 410);
      page.touch(page[control], 'touchcancel', 60, 410);
      page.window.document.dispatchEvent(
        new page.window.CustomEvent('ln:chapter-change'),
      );

      expect(page.savedPositions()).toEqual([]);
      expect(page.position()).toEqual({ left: '40px', top: '200px' });
    },
  );

  it('keeps a drag that the app does not send back', async () => {
    const page = await loadPage({ savedPosition: { x: 0.1, y: 0.25 } });
    page.drag(page.bubble, [50, 210], [210, 410]);
    page.window.document.dispatchEvent(
      new page.window.CustomEvent('ln:chapter-change'),
    );

    expect(page.position()).toEqual({ left: '200px', top: '400px' });
  });

  it('re-applies the saved position when a chapter is swapped in', async () => {
    const page = await loadPage({ savedPosition: { x: 0.1, y: 0.25 } });
    page.window.reader.readerSettings.val = {
      tts: { controllerPosition: { x: 0.5, y: 0.5 } },
    };
    page.window.document.dispatchEvent(
      new page.window.CustomEvent('ln:chapter-change'),
    );

    expect(page.position()).toEqual({ left: '200px', top: '400px' });
  });

  it.each([true, false])(
    'applies the saved position when TTS is switched on (initially %s)',
    async ttsEnabled => {
      const page = await loadPage({
        savedPosition: { x: 0.5, y: 0.25 },
        ttsEnabled,
      });
      for (const TTSEnable of [false, true]) {
        page.window.reader.generalSettings.val = { TTSEnable };
        await page.settle();
      }

      expect(page.position()).toEqual({ left: '200px', top: '200px' });
    },
  );

  it('returns to the saved spot after rotating there and back', async () => {
    const page = await loadPage({ savedPosition: { x: 0.8, y: 0.75 } });
    const rotate = (width: number, height: number) => {
      page.window.innerWidth = width;
      page.window.innerHeight = height;
      page.window.dispatchEvent(new page.window.Event('resize'));
    };

    rotate(200, 400);
    expect(page.position()).toEqual({ left: '142px', top: '300px' });
    rotate(400, 800);
    expect(page.position()).toEqual({ left: '320px', top: '600px' });
    expect(page.savedPositions()).toEqual([]);
  });

  it('returns to the saved spot after expanding near an edge', async () => {
    const page = await loadPage({ savedPosition: { x: 0.8, y: 0.25 } });

    await page.toggle();
    expect(page.position()).toEqual({ left: '72px', top: '200px' });
    await page.toggle();
    expect(page.position()).toEqual({ left: '320px', top: '200px' });
    expect(page.savedPositions()).toEqual([]);
  });

  it.each([[undefined], [{ x: 'far', y: null }], [{ x: 2, y: 0.5 }]])(
    'keeps the CSS default when the saved position is %j',
    async savedPosition => {
      const page = await loadPage({ savedPosition });

      expect(page.position()).toEqual({ left: '', top: '' });
    },
  );
});
