import { createReaderLinkHandlers } from '../handleReaderLink';

jest.mock('sanitize-html', () => ({
  __esModule: true,
  default: Object.assign(jest.fn(), { defaults: { allowedTags: ['p'] } }),
}));

const setup = (isNovel = false) => {
  const actions = {
    openNovel: jest.fn(() => isNovel),
    openExternal: jest.fn(),
    inject: jest.fn(),
    refresh: jest.fn(),
  };
  return { ...createReaderLinkHandlers(actions), actions };
};

describe('createReaderLinkHandlers', () => {
  it.each(['', '_SELF', '_parent', '_top'])(
    'loads a same-window link in the page (target "%s")',
    target => {
      const handlers = setup();

      handlers.handlePage({ url: 'https://example.com', target });

      expect(handlers.actions.inject).toHaveBeenCalledWith(
        'window.location.href = "https://example.com"; true;',
      );
      expect(handlers.shouldStartLoad('https://example.com')).toBe(true);
    },
  );

  it.each(['_blank', '_new', 'named'])(
    'opens a link for another window in the browser (target "%s")',
    target => {
      const handlers = setup();

      handlers.handlePage({ url: 'https://example.com', target });

      expect(handlers.actions.openExternal).toHaveBeenCalledWith(
        'https://example.com',
      );
    },
  );

  it('opens a novel link from each entry point in the app', () => {
    const handlers = setup(true);
    const url = 'https://royalroad.com/fiction/123';

    handlers.handlePage({ url, target: '_blank' });
    handlers.openWindow(url);

    expect(handlers.shouldStartLoad(url)).toBe(false);
    expect(handlers.actions.openNovel).toHaveBeenCalledTimes(3);
    expect(handlers.actions.openExternal).not.toHaveBeenCalled();
  });

  it('keeps the chapter refresh and non-web links working', () => {
    const handlers = setup();

    expect(handlers.shouldStartLoad('lnreader://refresh-chapter')).toBe(false);
    expect(handlers.actions.refresh).toHaveBeenCalledTimes(1);
    expect(handlers.shouldStartLoad('mailto:author@example.com')).toBe(true);
  });

  it('opens a plugin issue report in the browser', () => {
    const handlers = setup();
    const url = 'https://github.com/lnreader/lnreader-plugins/issues/new';

    expect(handlers.shouldStartLoad(url)).toBe(false);
    expect(handlers.actions.openExternal).toHaveBeenCalledWith(url);
  });

  it.each(['about:blank', 'javascript:void(0)'])(
    'ignores a new window for %s',
    url => {
      const handlers = setup();

      handlers.openWindow(url);

      expect(handlers.actions.openExternal).not.toHaveBeenCalled();
    },
  );

  it.each([undefined, {}, { url: 'mailto:author@example.com' }])(
    'ignores a page message without a web URL (%p)',
    data => {
      const handlers = setup(true);

      handlers.handlePage(data);

      expect(handlers.actions.openNovel).not.toHaveBeenCalled();
      expect(handlers.actions.inject).not.toHaveBeenCalled();
      expect(handlers.actions.openExternal).not.toHaveBeenCalled();
    },
  );
});
