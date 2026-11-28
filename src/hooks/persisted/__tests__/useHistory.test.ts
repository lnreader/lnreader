import { act, renderHook, waitFor } from '@testing-library/react-native';
import useHistory from '../useHistory';
import { SyncStatus } from '@services/sync/types';

let mockSyncStatusListener: ((status: SyncStatus) => void) | undefined;
const mockGetHistoryFromDb = jest.fn();
const mockAddSyncStatusListener = jest.fn(
  (listener: (status: SyncStatus) => void) => {
    mockSyncStatusListener = listener;
    return () => {
      mockSyncStatusListener = undefined;
    };
  },
);

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@database/queries/HistoryQueries', () => ({
  deleteAllHistory: jest.fn(),
  deleteChapterHistory: jest.fn(),
  deleteNovelHistory: jest.fn(),
  getHistoryFromDb: () => mockGetHistoryFromDb(),
}));

jest.mock('@services/sync/driveSyncManager', () => ({
  driveSyncManager: {
    addSyncStatusListener: (listener: (status: SyncStatus) => void) =>
      mockAddSyncStatusListener(listener),
  },
}));

describe('useHistory', () => {
  beforeEach(() => {
    mockSyncStatusListener = undefined;
    mockGetHistoryFromDb.mockReset();
    mockGetHistoryFromDb.mockResolvedValue([]);
    mockAddSyncStatusListener.mockClear();
  });

  it('reloads reading history when Drive sync completes', async () => {
    renderHook(() => useHistory());

    expect(mockAddSyncStatusListener).toHaveBeenCalledTimes(1);
    expect(mockGetHistoryFromDb).not.toHaveBeenCalled();

    act(() => {
      mockSyncStatusListener?.(SyncStatus.IDLE);
    });

    await waitFor(() => {
      expect(mockGetHistoryFromDb).toHaveBeenCalledTimes(1);
    });
  });

  it('safely handles unmount while getHistoryFromDb is resolving', async () => {
    let resolveDb: (val: any) => void = () => {};
    const dbPromise = new Promise(resolve => {
      resolveDb = resolve;
    });
    mockGetHistoryFromDb.mockReturnValue(dbPromise);

    const { unmount } = renderHook(() => useHistory());

    act(() => {
      mockSyncStatusListener?.(SyncStatus.IDLE);
    });

    // Unmount before query resolves
    unmount();

    // Now resolve the promise
    await act(async () => {
      resolveDb([
        {
          id: 1,
          novelId: 1,
          novelName: 'Novel',
          name: 'Chapter 1',
        },
      ]);
      await dbPromise;
    });

    // If no guard existed, React warning or state update on unmounted component would occur
    expect(mockGetHistoryFromDb).toHaveBeenCalledTimes(1);
  });
});
