import { renderHook } from '@testing-library/react-native';

import useNovelLinkNavigation from '../useNovelLinkNavigation';

const mockNavigation = {
  focused: true,
  push: jest.fn(),
  isFocused: () => mockNavigation.focused,
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
    mockNavigation.focused = true;
    mockNavigation.push.mockReset();
    // Like the real navigator: after the push the reader is no longer focused.
    mockNavigation.push.mockImplementation(() => {
      mockNavigation.focused = false;
    });
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

  // A double tap reaches the app twice before the novel screen covers the
  // reader.
  it('opens the novel once when the link is tapped twice', () => {
    const { result } = renderHook(() => useNovelLinkNavigation(reader));

    result.current(LINK);
    const second = result.current(LINK);

    expect(second).toBe(true);
    expect(mockNavigation.push).toHaveBeenCalledTimes(1);
  });
});
