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

const NOVEL_LINK = 'https://royalroad.com/fiction/123';

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
    // An online chapter is loaded with the plugin site as its base URL.
    location: { href: 'https://www.royalroad.com/' },
  };

  runInNewContext(core.slice(start, end + closing.length), context);

  const tap = (
    onLink: boolean,
    target = '',
    href = NOVEL_LINK,
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
  it('sends a web link to the app without toggling the reader controls', () => {
    const { tap, post } = loadClickHandler();

    expect(tap(true).preventDefault).toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({
      type: 'link',
      data: { url: NOVEL_LINK, target: '' },
    });
  });

  it('sends the link target with the link', () => {
    const { tap, post } = loadClickHandler();

    expect(tap(true, '_blank').preventDefault).toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({
      type: 'link',
      data: { url: NOVEL_LINK, target: '_blank' },
    });
  });

  it('still toggles the controls for a tap on text', () => {
    const { tap, post } = loadClickHandler();

    tap(false);

    expect(post).toHaveBeenCalledWith({ type: 'hide' });
  });

  it('still toggles the controls for a cancelled tap on text', () => {
    const { tap, post } = loadClickHandler();

    tap(false, '', '', true);

    expect(post).toHaveBeenCalledWith({ type: 'hide' });
  });

  it('leaves a link that another handler cancelled alone', () => {
    const { tap, post } = loadClickHandler();

    tap(true, '', NOVEL_LINK, true);

    expect(post).not.toHaveBeenCalled();
  });

  it('stops a second tap while the first one opens the link', () => {
    const { tap, clock, post } = loadClickHandler();

    tap(true);
    clock.now += 300;

    expect(tap(true).preventDefault).toHaveBeenCalled();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('sends the link again after one second', () => {
    const { tap, clock, post } = loadClickHandler();

    tap(true);
    clock.now += 2000;
    tap(true);

    expect(post).toHaveBeenCalledTimes(2);
  });

  it.each(['https://www.royalroad.com/#note-1', 'https://www.royalroad.com/#'])(
    'lets a link inside the document scroll the page (%s)',
    href => {
      const { tap, post } = loadClickHandler();

      expect(tap(true, '', href).preventDefault).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    },
  );

  it('sends a fragment link to another page to the app', () => {
    const { tap, post } = loadClickHandler();
    const url = 'https://www.royalroad.com/fiction/123#chapters';

    expect(tap(true, '', url).preventDefault).toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith({
      type: 'link',
      data: { url, target: '' },
    });
  });

  it('does not count a link inside the document as a first tap', () => {
    const { tap, clock, post } = loadClickHandler();

    tap(true, '', 'https://www.royalroad.com/#note');
    clock.now += 100;
    tap(true);

    expect(post).toHaveBeenCalledTimes(1);
    expect(
      tap(true, '', 'https://www.royalroad.com/#back').preventDefault,
    ).not.toHaveBeenCalled();
  });

  it.each([
    'lnreader://refresh-chapter',
    'mailto:author@example.com',
    'intent:example',
  ])('leaves %s to the WebView but stops a second tap', url => {
    const { tap, clock, post } = loadClickHandler();

    expect(tap(true, '', url).preventDefault).not.toHaveBeenCalled();
    clock.now += 300;
    expect(tap(true, '', url).preventDefault).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });
});
