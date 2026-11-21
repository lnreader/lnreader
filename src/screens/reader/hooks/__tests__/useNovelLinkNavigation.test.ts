import { renderHook } from '@testing-library/react-native';

import useNovelLinkNavigation from '../useNovelLinkNavigation';

const mockNavigation = {
  push: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@services/share/resolveSharedUrl', () => ({
  resolveNovelLink: (url: string) =>
    url.includes('/fiction/')
      ? { pluginId: 'royalroad', path: 'fiction/104434' }
      : undefined,
}));

const LINK = 'https://www.royalroad.com/fiction/104434/the-elf';
const reader = { pluginId: 'royalroad', path: 'fiction/112921' };

describe('useNovelLinkNavigation', () => {
  beforeEach(() => {
    mockNavigation.push.mockReset();
  });

  it('opens a linked novel in its own reader stack', () => {
    const { result } = renderHook(() => useNovelLinkNavigation(reader));

    expect(result.current(LINK)).toBe(true);

    expect(mockNavigation.push).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        cover: null,
        pluginId: 'royalroad',
        path: 'fiction/104434',
      },
    });
  });

  it('opens a link to the current novel on the current stack', () => {
    const { result } = renderHook(() =>
      useNovelLinkNavigation({ pluginId: 'royalroad', path: 'fiction/104434' }),
    );

    expect(result.current(LINK)).toBe(true);

    expect(mockNavigation.push).toHaveBeenCalledWith('Novel', {
      name: '',
      cover: null,
      pluginId: 'royalroad',
      path: 'fiction/104434',
    });
  });

  it('leaves other links to the WebView', () => {
    const { result } = renderHook(() => useNovelLinkNavigation(reader));

    expect(result.current('https://example.com/page')).toBe(false);
    expect(mockNavigation.push).not.toHaveBeenCalled();
  });
});
