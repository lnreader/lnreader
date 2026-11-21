import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';

type TapEvent = {
  target: { closest: (selector: string) => unknown };
  defaultPrevented: boolean;
  clientX: number;
  clientY: number;
  preventDefault: jest.Mock;
};

const loadClickHandler = () => {
  const core = readFileSync(
    join(process.cwd(), 'assets/reader/js/core.js'),
    'utf8',
  );
  const start = core.indexOf('// click handler\n(function () {');
  const closing = '\n})();';
  const end = core.indexOf(closing, start);

  if (start < 0 || end < 0) {
    throw new Error('Could not locate the reader click handler');
  }

  const clock = { now: 1_000_000 };
  const context = {
    Date: { now: () => clock.now },
    document: {} as { onclick?: (event: TapEvent) => void },
    pageReader: { ignoreClickUntil: 0 },
    reader: {
      post: jest.fn(),
      layoutWidth: 400,
      layoutHeight: 800,
      generalSettings: { val: { pageReader: false, tapToScroll: false } },
    },
    window: {},
  };

  runInNewContext(core.slice(start, end + closing.length), context);

  const tap = (
    onLink: boolean,
    target = '',
    href = 'https://royalroad.com/fiction/123',
    defaultPrevented = false,
  ) => {
    const event: TapEvent = {
      target: {
        closest: () => (onLink ? { href, target } : null),
      },
      defaultPrevented,
      clientX: 200,
      clientY: 400,
      preventDefault: jest.fn(),
    };
    context.document.onclick?.(event);
    return event;
  };

  return { tap, clock, post: context.reader.post };
};

describe('reader link taps', () => {
  it('lets a link open without toggling the reader controls', () => {
    const { tap, post } = loadClickHandler();

    expect(tap(true).preventDefault).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('still toggles the controls for a tap on text', () => {
    const { tap, post } = loadClickHandler();

    tap(false);

    expect(post).toHaveBeenCalledWith({ type: 'hide' });
  });
});
