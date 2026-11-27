import { act, renderHook } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { useKeyboardHeight } from '../useKeyboardHeight';

describe('useKeyboardHeight', () => {
  let showCallback: Function;
  let hideCallback: Function;
  let mockAddListener: jest.Mock;
  const mockShowRemove = jest.fn();
  const mockHideRemove = jest.fn();

  beforeAll(() => {
    mockAddListener = jest.fn((event: string, cb: Function) => {
      if (event === 'keyboardDidShow') showCallback = cb;
      if (event === 'keyboardDidHide') hideCallback = cb;
      return event === 'keyboardDidShow'
        ? { remove: mockShowRemove }
        : { remove: mockHideRemove };
    });
    jest.spyOn(Keyboard, 'addListener').mockImplementation(mockAddListener);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    showCallback = () => { };
    hideCallback = () => { };
    mockShowRemove.mockClear();
    mockHideRemove.mockClear();
    mockAddListener.mockClear();
  });

  it('returns 0 initially', () => {
    const { result } = renderHook(() => useKeyboardHeight());
    expect(result.current).toBe(0);
  });

  it('after keyboardDidShow with endCoordinates.height = 350, returns 350', () => {
    const { result } = renderHook(() => useKeyboardHeight());

    act(() => {
      showCallback({ endCoordinates: { height: 350 } });
    });

    expect(result.current).toBe(350);
  });

  it('after keyboardDidHide, returns 0', () => {
    const { result } = renderHook(() => useKeyboardHeight());

    act(() => {
      showCallback({ endCoordinates: { height: 350 } });
    });
    expect(result.current).toBe(350);

    act(() => {
      hideCallback();
    });
    expect(result.current).toBe(0);
  });

  it('cleanup: on unmount, calls remove() on both listeners', () => {
    const { unmount } = renderHook(() => useKeyboardHeight());

    unmount();

    expect(mockShowRemove).toHaveBeenCalledTimes(1);
    expect(mockHideRemove).toHaveBeenCalledTimes(1);
  });
});
