import { act, renderHook } from '@testing-library/react-native';
import useTimeTracking from '../useTimeTracking';

// Capture the listener so tests can fire fake AppState events
let appStateHandler: (state: string) => void;

jest.mock('react-native', () => {
  return {
    AppState: {
      currentState: 'active',
      addEventListener: jest.fn((_event, handler) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      }),
    },
  };
});

describe('useTimeTracking', () => {
  const increaseTimeSpent = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('flushes elapsed time on the 60s interval', () => {
    renderHook(() => useTimeTracking(1, false, increaseTimeSpent));

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(increaseTimeSpent).toHaveBeenCalledWith(1, expect.any(Number));
    const elapsed = increaseTimeSpent.mock.calls[0][1];
    expect(elapsed).toBeGreaterThanOrEqual(60000);
  });

  it('flushes when the app goes to the background', () => {
    renderHook(() => useTimeTracking(1, false, increaseTimeSpent));

    act(() => {
      jest.advanceTimersByTime(5000);
      appStateHandler('background');
    });

    expect(increaseTimeSpent).toHaveBeenCalledWith(1, expect.any(Number));
  });

  it('does not double count after backgrounding and foregrounding', () => {
    renderHook(() => useTimeTracking(1, false, increaseTimeSpent));

    act(() => {
      jest.advanceTimersByTime(5000);
      appStateHandler('background'); // flush 5s
      jest.advanceTimersByTime(20000);
      appStateHandler('active');
      jest.advanceTimersByTime(3000);
      appStateHandler('background'); // flush 3s
    });

	const firstElapsed = increaseTimeSpent.mock.calls[0][1];
	expect(firstElapsed).toBeLessThan(6000); // 5s flush
	const secondElapsed = increaseTimeSpent.mock.calls[1][1];
	expect(secondElapsed).toBeLessThan(4000); // 3s flush
  });

  it('flushes remaining time on unmount', () => {
    const { unmount } = renderHook(() =>
      useTimeTracking(1, false, increaseTimeSpent),
    );

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    unmount();

    expect(increaseTimeSpent).toHaveBeenLastCalledWith(1, expect.any(Number));
  });

  it('flushes for the previous chapter id when chapterId changes', () => {
    const { rerender } = renderHook(
      ({ chapterId }: { chapterId: number }) => useTimeTracking(chapterId, false, increaseTimeSpent),
      { initialProps: { chapterId: 1 } },
    );

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    rerender({ chapterId: 2 });

    expect(increaseTimeSpent).toHaveBeenCalledWith(1, expect.any(Number));
    expect(increaseTimeSpent).not.toHaveBeenCalledWith(2, expect.any(Number));
  });

  it('does not track time in incognito mode', () => {
    renderHook(() => useTimeTracking(1, true, increaseTimeSpent));

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(increaseTimeSpent).not.toHaveBeenCalled();
  });
});
