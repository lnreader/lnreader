/**
 * useRsvpSettings — settings shape/bounds tests (spec-1576 AC5, RED first).
 *
 * Contract: always returns a COMPLETE RsvpSettings object (defaults fill
 * missing fields); wpm clamped to [150, 800] and rounded; chunkSize
 * clamped to integers [1, 3]; writes persist through the MMKV object hook.
 */

import { renderHook, act } from '@testing-library/react-native';
import { useRsvpSettings, RSVP_WPM_BOUNDS } from '../useRsvpSettings';

const mockSetStored = jest.fn();
let mockStored: Record<string, unknown> | undefined;

jest.mock('react-native-mmkv', () => ({
  useMMKVObject: jest.fn((_key: string) => [
    mockStored,
    (value: Record<string, unknown> | undefined) => {
      mockStored = value;
      mockSetStored(value);
    },
  ]),
}));

beforeEach(() => {
  mockStored = undefined;
  mockSetStored.mockClear();
});

describe('useRsvpSettings — defaults', () => {
  it('returns {wpm: 250, chunkSize: 1} when nothing is stored', () => {
    const { result } = renderHook(() => useRsvpSettings());

    expect(result.current.rsvpSettings).toEqual({ wpm: 250, chunkSize: 1 });
  });

  it('fills missing fields from defaults when the stored object is partial', () => {
    mockStored = { wpm: 400 };

    const { result } = renderHook(() => useRsvpSettings());

    expect(result.current.rsvpSettings).toEqual({ wpm: 400, chunkSize: 1 });
  });
});

describe('useRsvpSettings — bounds enforcement', () => {
  it('clamps wpm into [150, 800]', () => {
    mockStored = { wpm: 9999 };
    expect(
      renderHook(() => useRsvpSettings()).result.current.rsvpSettings.wpm,
    ).toBe(RSVP_WPM_BOUNDS.max);

    mockStored = { wpm: -5 };
    expect(
      renderHook(() => useRsvpSettings()).result.current.rsvpSettings.wpm,
    ).toBe(RSVP_WPM_BOUNDS.min);
  });

  it('clamps chunkSize into [1, 3]', () => {
    mockStored = { chunkSize: 7 };
    expect(
      renderHook(() => useRsvpSettings()).result.current.rsvpSettings.chunkSize,
    ).toBe(3);

    mockStored = { chunkSize: 0.4 };
    expect(
      renderHook(() => useRsvpSettings()).result.current.rsvpSettings.chunkSize,
    ).toBe(1);
  });
});

describe('useRsvpSettings — writes', () => {
  it('setRsvp merges with current values and persists normalized object', async () => {
    const { result, rerender } = renderHook(() => useRsvpSettings());

    act(() => result.current.setRsvp({ wpm: 600 }));

    expect(mockSetStored).toHaveBeenCalledWith({ wpm: 600, chunkSize: 1 });

    // Simulate the MMKV subscription delivering the new stored value
    // (real useMMKVObject re-renders on store change).
    rerender({});

    act(() => result.current.setRsvp({ chunkSize: 2 }));

    expect(mockSetStored).toHaveBeenLastCalledWith({
      wpm: 600,
      chunkSize: 2,
    });
  });

  it('setRsvp clamps out-of-bounds patches instead of persisting them raw', () => {
    const { result } = renderHook(() => useRsvpSettings());

    act(() => result.current.setRsvp({ wpm: 5000, chunkSize: 99 }));

    expect(mockSetStored).toHaveBeenLastCalledWith({
      wpm: RSVP_WPM_BOUNDS.max,
      chunkSize: 3,
    });
  });

  it('REGRESSION WITNESS: three back-to-back patches all retain their fields', async () => {
    // Permanent witness for the stale-closure bug caught during the first
    // GREEN loop (grillmaster promotion, 2026-08-23): sequential patches
    // {wpm}, {chunkSize} then a wpm re-adjustment must compose — no field
    // may revert to defaults because an earlier patch was forgotten.
    const { result, rerender } = renderHook(() => useRsvpSettings());

    act(() => result.current.setRsvp({ wpm: 400 }));
    rerender({});
    act(() => result.current.setRsvp({ chunkSize: 3 }));
    rerender({});
    act(() => result.current.setRsvp({ wpm: 550 }));

    expect(mockSetStored).toHaveBeenLastCalledWith({
      wpm: 550,
      chunkSize: 3,
    });
  });
});
