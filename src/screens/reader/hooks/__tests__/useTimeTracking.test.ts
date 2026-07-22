import { act, renderHook } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import useTimeTracking from '../useTimeTracking';

// Capture the listener so tests can fire fake AppState events
let appStateHandler: (state: AppStateStatus) => void;

describe('useTimeTracking', () => {
  const increaseTimeSpent = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    AppState.currentState = 'active';
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('flushes when the app goes to the background', () => {
    renderHook(() => useTimeTracking(1, false, 60000, true, increaseTimeSpent));

    act(() => {
      jest.advanceTimersByTime(5000);
      appStateHandler('background');
    });

    expect(increaseTimeSpent).toHaveBeenCalledWith(1, 5000);
  });

  it('does not double count after backgrounding and foregrounding', () => {
    renderHook(() => useTimeTracking(1, false, 60000, true, increaseTimeSpent));

    act(() => {
      jest.advanceTimersByTime(5000);
      appStateHandler('background');
      jest.advanceTimersByTime(20000);
      appStateHandler('active');
      jest.advanceTimersByTime(3000);
      appStateHandler('background'); // flush 3s
    });

    expect(increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 5000);
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(2, 1, 3000);
    expect(increaseTimeSpent).toHaveBeenCalledTimes(2);
  });

  it('flushes remaining time on unmount', () => {
    const { unmount } = renderHook(() =>
      useTimeTracking(1, false, 60000, true, increaseTimeSpent),
    );

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    unmount();

    expect(increaseTimeSpent).toHaveBeenLastCalledWith(1, 10000);
  });

  it('flushes for the previous chapter id when chapterId changes', () => {
    const { rerender } = renderHook(
      ({ chapterId }: { chapterId: number }) =>
        useTimeTracking(chapterId, false, 60000, true, increaseTimeSpent),
      { initialProps: { chapterId: 1 } },
    );

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    rerender({ chapterId: 2 });

    expect(increaseTimeSpent).toHaveBeenCalledWith(1, 10000);
    expect(increaseTimeSpent).not.toHaveBeenCalledWith(2, expect.any(Number));
  });

  it('flushes after user interaction', () => {
    const onUserInteraction = renderHook(() =>
      useTimeTracking(1, false, 60000, true, increaseTimeSpent),
    ).result.current.onUserInteraction;

    act(() => {
      jest.advanceTimersByTime(10000);
      onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenCalledWith(1, 10000);
  });

  it('does not track time when time tracking is turned off', () => {
    const onUserInteraction = renderHook(() => useTimeTracking(1, false, 60000, false, increaseTimeSpent)).result.current.onUserInteraction;

    act(() => {
      jest.advanceTimersByTime(6000);
      onUserInteraction();
    });

    expect(increaseTimeSpent).not.toHaveBeenCalled();
  });

  it('does not track time when the user is inactive for too long', () => {
    const onUserInteraction = renderHook(() => useTimeTracking(1, false, 60000, true, increaseTimeSpent)).result.current.onUserInteraction;

    act(() => {
      jest.advanceTimersByTime(70000);
      onUserInteraction();
    });

    expect(increaseTimeSpent).not.toHaveBeenCalled();
  });

  it('resets inactivity timeout correctly', () => {
    const onUserInteraction = renderHook(() => useTimeTracking(1, false, 60000, true, increaseTimeSpent)).result.current.onUserInteraction;

    act(() => {
      jest.advanceTimersByTime(30000);
      onUserInteraction();
      jest.advanceTimersByTime(30000);
      onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 30000);
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(2, 1, 30000);
    expect(increaseTimeSpent).toHaveBeenCalledTimes(2);
  });

  it('tracks time accurately when the user interacts multiple times in quick succession', () => {
    const onUserInteraction = renderHook(() => useTimeTracking(1, false, 60000, true, increaseTimeSpent)).result.current.onUserInteraction;

    act(() => {
      jest.advanceTimersByTime(30000);
      onUserInteraction();
      onUserInteraction(); // clock didn't advance, so shouldn't call increaseTimeSpent again
      jest.advanceTimersByTime(2);
      onUserInteraction();
      jest.advanceTimersByTime(20000);
      onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 30000);
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(2, 1, 2);
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(3, 1, 20000);
    expect(increaseTimeSpent).toHaveBeenCalledTimes(3);
  });

  it('tracks time accurately even when the user goes inactive for a while', () => {
    const onUserInteraction = renderHook(() => useTimeTracking(1, false, 60000, true, increaseTimeSpent)).result.current.onUserInteraction;

    act(() => {
      jest.advanceTimersByTime(30000);
      onUserInteraction();
      jest.advanceTimersByTime(10000);
      onUserInteraction();
      jest.advanceTimersByTime(50000);
      onUserInteraction();

      // Inactivity
      jest.advanceTimersByTime(100000);
      onUserInteraction(); // shouldn't do anything
      jest.advanceTimersByTime(30000);
      onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 30000);
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(2, 1, 10000);
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(3, 1, 50000);
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(4, 1, 30000);

    expect(increaseTimeSpent).toHaveBeenCalledTimes(4);
  });

  it('does not track time in incognito mode', () => {
    const onUserInteraction = renderHook(() => useTimeTracking(1, true, 60000, true, increaseTimeSpent)).result.current.onUserInteraction;

    act(() => {
      jest.advanceTimersByTime(6000);
      onUserInteraction();
    });

    expect(increaseTimeSpent).not.toHaveBeenCalled();
  });
  it('tracks time when TTS is reading even if the user is inactive for too long', () => {
    const { result } = renderHook(() =>
      useTimeTracking(1, false, 60000, true, increaseTimeSpent),
    );

    act(() => {
      result.current.isTTSReadingRef.current = true;
      jest.advanceTimersByTime(70000);
      result.current.onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenCalledWith(1, 70000);
  });

  it('tracks time when TTS is reading even if the app goes to the background', () => {
    const { result } = renderHook(() =>
      useTimeTracking(1, false, 60000, true, increaseTimeSpent),
    );

    act(() => {
      result.current.isTTSReadingRef.current = true;
      jest.advanceTimersByTime(70000);
      appStateHandler('background');
      jest.advanceTimersByTime(10000);
      result.current.onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 70000); // on background
    expect(increaseTimeSpent).toHaveBeenNthCalledWith(2, 1, 10000); // on user interaction after background
  });
  it('does not double-count when onUserInteraction is called back-to-back during TTS', () => {
    const { result } = renderHook(() =>
      useTimeTracking(1, false, 60000, true, increaseTimeSpent),
    );

    act(() => {
      result.current.isTTSReadingRef.current = true;
      jest.advanceTimersByTime(5000);
      result.current.onUserInteraction();
      result.current.onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 5000);
    expect(increaseTimeSpent).toHaveBeenCalledTimes(1);
  });
  it('resumes normal inactivity gating once TTS stops', () => {
    const { result } = renderHook(() =>
      useTimeTracking(1, false, 60000, true, increaseTimeSpent),
    );

    act(() => {
      result.current.isTTSReadingRef.current = true;
      jest.advanceTimersByTime(5000);
      result.current.onUserInteraction();
      result.current.isTTSReadingRef.current = false;
      jest.advanceTimersByTime(70000);
      result.current.onUserInteraction();
    });

    expect(increaseTimeSpent).toHaveBeenNthCalledWith(1, 1, 5000);
    expect(increaseTimeSpent).toHaveBeenCalledTimes(1);
  });
});
