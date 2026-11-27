import {
  driveSyncManager,
  notifySyncDirty,
  isSyncDirty,
  clearSyncDirty,
  flushPendingSync,
  triggerStartupPull,
  getSyncDeviceId,
} from '../driveSyncManager';
import {
  SyncStatus,
  DRIVE_SYNC_DEVICE_ID,
  DRIVE_SYNC_DIRTY,
  DRIVE_SYNC_WATERMARKS,
} from '../types';
import { APP_SETTINGS } from '@hooks/persisted/useSettings';

const mockStorage = new Map<string, any>();

jest.mock('@utils/mmkv/mmkv', () => ({
  MMKVStorage: {
    getString: jest.fn((key: string) => mockStorage.get(key)),
    getBoolean: jest.fn((key: string) => mockStorage.get(key)),
    getNumber: jest.fn((key: string) => mockStorage.get(key)),
    set: jest.fn((key: string, val: any) => mockStorage.set(key, val)),
    delete: jest.fn((key: string) => mockStorage.delete(key)),
  },
  getMMKVObject: jest.fn((key: string) => {
    const val = mockStorage.get(key);
    return val ? (typeof val === 'string' ? JSON.parse(val) : val) : undefined;
  }),
  setMMKVObject: jest.fn((key: string, obj: any) => {
    mockStorage.set(key, JSON.stringify(obj));
  }),
}));

const mockNetInfoFetch = jest.fn();
let netInfoListener: ((state: any) => void) | null = null;
const mockNetInfoUnsubscribe = jest.fn(() => {
  netInfoListener = null;
});
const mockNetInfoAddEventListener = jest.fn((cb: (state: any) => void) => {
  netInfoListener = cb;
  return mockNetInfoUnsubscribe;
});
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    fetch: () => mockNetInfoFetch(),
    addEventListener: (cb: any) => mockNetInfoAddEventListener(cb),
  },
}));

const mockHasPreviousSignIn = jest.fn();
const mockGetTokens = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPreviousSignIn: () => mockHasPreviousSignIn(),
    getTokens: () => mockGetTokens(),
  },
}));

const mockDriveList = jest.fn();
const mockDriveCreate = jest.fn();
const mockDrivePatch = jest.fn();
const mockDriveGetMedia = jest.fn();
jest.mock('@api/drive/request', () => ({
  list: (params: any) => mockDriveList(params),
  create: (data: any) => mockDriveCreate(data),
  patch: (fileId: string, body: any) => mockDrivePatch(fileId, body),
  getMedia: (fileId: string) => mockDriveGetMedia(fileId),
}));

const mockQueryActiveSyncEntities = jest.fn();
const mockMergeRemoteSyncPayload = jest.fn();
jest.mock('@database/queries/SyncQueries', () => ({
  queryActiveSyncEntities: () => mockQueryActiveSyncEntities(),
  mergeRemoteSyncPayload: (payload: any) => mockMergeRemoteSyncPayload(payload),
}));

describe('driveSyncManager', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockStorage.clear();

    // Default: online on Wi-Fi
    mockNetInfoFetch.mockResolvedValue({
      isConnected: true,
      type: 'wifi',
    });

    // Default: signed in with valid access token
    mockHasPreviousSignIn.mockResolvedValue(true);
    mockGetTokens.mockResolvedValue({ accessToken: 'mock-access-token' });

    // Default: sync enabled
    mockStorage.set(
      APP_SETTINGS,
      JSON.stringify({
        driveSyncEnabled: true,
        driveSyncWifiOnly: false,
      }),
    );

    // Default active entities
    mockQueryActiveSyncEntities.mockResolvedValue({
      novels: [],
      chapters: [],
      categories: [],
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('dirty flag management', () => {
    it('creates and persists a device ID', () => {
      const deviceId = getSyncDeviceId();

      expect(deviceId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(mockStorage.get(DRIVE_SYNC_DEVICE_ID)).toBe(deviceId);
      expect(getSyncDeviceId()).toBe(deviceId);
    });

    it('sets and clears dirty flag in MMKV', () => {
      expect(isSyncDirty()).toBe(false);

      notifySyncDirty();
      expect(isSyncDirty()).toBe(true);
      expect(mockStorage.get(DRIVE_SYNC_DIRTY)).toBe(true);

      clearSyncDirty();
      expect(isSyncDirty()).toBe(false);
      expect(mockStorage.get(DRIVE_SYNC_DIRTY)).toBe(false);
    });
  });

  describe('flushPendingSync', () => {
    it('does nothing when sync is disabled in settings', async () => {
      mockStorage.set(
        APP_SETTINGS,
        JSON.stringify({
          driveSyncEnabled: false,
        }),
      );

      await flushPendingSync();

      expect(mockDriveList).not.toHaveBeenCalled();
      expect(mockDriveCreate).not.toHaveBeenCalled();
    });

    it('creates remote device file when it does not exist', async () => {
      notifySyncDirty();
      mockDriveList.mockResolvedValue({ files: [] });
      mockDriveCreate.mockResolvedValue({ id: 'new-file-id' });

      await flushPendingSync();

      expect(mockDriveList).toHaveBeenCalled();
      expect(mockDriveCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            name: expect.stringMatching(/^sync_device_.*\.json$/),
            parents: ['appDataFolder'],
          }),
        }),
      );
      expect(mockDriveCreate).toHaveBeenCalledWith(
        expect.not.objectContaining({ content: expect.anything() }),
      );
      expect(mockDrivePatch).toHaveBeenCalledWith(
        'new-file-id',
        expect.objectContaining({
          version: 1,
          deviceId: getSyncDeviceId(),
        }),
      );

      expect(isSyncDirty()).toBe(false);
      expect(driveSyncManager.getStatus()).toBe(SyncStatus.IDLE);
    });

    it('patches existing remote device file when it exists', async () => {
      notifySyncDirty();
      mockDriveList.mockResolvedValue({
        files: [
          {
            id: 'existing-file-123',
            name: `sync_device_${getSyncDeviceId()}.json`,
          },
        ],
      });
      mockDrivePatch.mockResolvedValue(undefined);

      await flushPendingSync();

      expect(mockDrivePatch).toHaveBeenCalledWith(
        'existing-file-123',
        expect.objectContaining({
          version: 1,
          deviceId: getSyncDeviceId(),
        }),
      );

      expect(isSyncDirty()).toBe(false);
    });

    it('sets status to OFFLINE and leaves dirty flag intact when offline', async () => {
      mockNetInfoFetch.mockResolvedValue({
        isConnected: false,
        type: 'none',
      });
      notifySyncDirty();

      await flushPendingSync();

      expect(driveSyncManager.getStatus()).toBe(SyncStatus.OFFLINE);
      expect(mockDriveCreate).not.toHaveBeenCalled();
      expect(isSyncDirty()).toBe(true);
    });

    it('sets status to AUTH_REQUIRED when user is not signed in', async () => {
      mockHasPreviousSignIn.mockResolvedValue(false);

      await flushPendingSync();

      expect(driveSyncManager.getStatus()).toBe(SyncStatus.AUTH_REQUIRED);
      expect(mockDriveCreate).not.toHaveBeenCalled();
    });
  });

  describe('triggerStartupPull', () => {
    it('downloads peer files, merges them, and updates watermarks', async () => {
      const myDeviceId = getSyncDeviceId();
      const recentTime = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const peerFile = {
        id: 'peer-file-id',
        name: 'sync_device_peer-1.json',
        modifiedTime: recentTime,
      };

      mockDriveList.mockResolvedValue({
        files: [
          peerFile,
          {
            id: 'my-file-id',
            name: `sync_device_${myDeviceId}.json`,
            modifiedTime: recentTime,
          },
        ],
      });

      const peerPayload = {
        version: 1,
        deviceId: 'peer-1',
        lastUpdated: Date.now(),
        novels: [],
        chapters: [],
        categories: [],
      };
      mockDriveGetMedia.mockResolvedValue(peerPayload);

      await triggerStartupPull();

      expect(mockDriveGetMedia).toHaveBeenCalledWith('peer-file-id');
      expect(mockMergeRemoteSyncPayload).toHaveBeenCalledWith(peerPayload);

      // Watermark updated in MMKV
      const watermarks = JSON.parse(mockStorage.get(DRIVE_SYNC_WATERMARKS));
      expect(watermarks['peer-1']).toBe(recentTime);
    });

    it('ignores stale peer files older than 60 days', async () => {
      const staleDate = new Date(
        Date.now() - 70 * 24 * 60 * 60 * 1000,
      ).toISOString();
      mockDriveList.mockResolvedValue({
        files: [
          {
            id: 'stale-peer-id',
            name: 'sync_device_stale-peer.json',
            modifiedTime: staleDate,
          },
        ],
      });

      await triggerStartupPull();

      expect(mockDriveGetMedia).not.toHaveBeenCalled();
      expect(mockMergeRemoteSyncPayload).not.toHaveBeenCalled();
    });

    it('flushes pending sync after pull if DRIVE_SYNC_DIRTY is true on cold launch', async () => {
      notifySyncDirty();

      mockDriveList
        .mockResolvedValueOnce({ files: [] }) // for startup pull
        .mockResolvedValueOnce({ files: [] }); // for flush search

      mockDriveCreate.mockResolvedValue({ id: 'new-id' });

      await triggerStartupPull();

      expect(mockDriveCreate).toHaveBeenCalled();
      expect(isSyncDirty()).toBe(false);
    });

    it('maintains SYNCING status across both pull and push without flapping to IDLE', async () => {
      notifySyncDirty();

      const statuses: SyncStatus[] = [];
      const unsubscribe = driveSyncManager.addSyncStatusListener(s =>
        statuses.push(s),
      );

      mockDriveList
        .mockResolvedValueOnce({ files: [] }) // startup pull search
        .mockResolvedValueOnce({ files: [] }); // flush search

      mockDriveCreate.mockResolvedValue({ id: 'pull-push-id' });

      await triggerStartupPull();
      unsubscribe();

      // Should not flap to IDLE before the push completes
      // Sequence must be: SYNCING -> IDLE (only after push finishes)
      expect(statuses).toEqual([SyncStatus.SYNCING, SyncStatus.IDLE]);
    });

    it('paginates through multiple pages using pageToken during startup pull', async () => {
      const recentTime = new Date().toISOString();
      mockDriveList
        .mockResolvedValueOnce({
          files: [
            {
              id: 'peer-page-1',
              name: 'sync_device_peer-p1.json',
              modifiedTime: recentTime,
            },
          ],
          nextPageToken: 'token-page-2',
        })
        .mockResolvedValueOnce({
          files: [
            {
              id: 'peer-page-2',
              name: 'sync_device_peer-p2.json',
              modifiedTime: recentTime,
            },
          ],
        });

      mockDriveGetMedia.mockResolvedValue({
        version: 1,
        deviceId: 'peer-p1',
        lastUpdated: Date.now(),
        novels: [],
        chapters: [],
        categories: [],
      });

      await triggerStartupPull();

      expect(mockDriveList).toHaveBeenCalledTimes(2);
      expect(mockDriveList).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ pageToken: 'token-page-2' }),
      );
      expect(mockDriveGetMedia).toHaveBeenCalledWith('peer-page-1');
      expect(mockDriveGetMedia).toHaveBeenCalledWith('peer-page-2');
    });

    it('prunes peer watermarks older than 60 days from MMKV', async () => {
      const now = Date.now();
      const freshTime = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();
      const staleTime = new Date(now - 70 * 24 * 60 * 60 * 1000).toISOString();

      mockStorage.set(
        DRIVE_SYNC_WATERMARKS,
        JSON.stringify({
          'peer-fresh': freshTime,
          'peer-stale': staleTime,
        }),
      );

      mockDriveList.mockResolvedValue({ files: [] });

      await triggerStartupPull();

      const watermarks = JSON.parse(mockStorage.get(DRIVE_SYNC_WATERMARKS));
      expect(watermarks['peer-fresh']).toBe(freshTime);
      expect(watermarks['peer-stale']).toBeUndefined();
    });
  });

  describe('in-flight sync & concurrency', () => {
    it('preserves dirty flag when a mutation occurs during an in-flight upload', async () => {
      notifySyncDirty();
      let resolvePatch: () => void = () => {};
      let notifyPatchStarted: () => void = () => {};
      const patchStartedPromise = new Promise<void>(res => {
        notifyPatchStarted = res;
      });
      const patchPromise = new Promise<void>(res => {
        resolvePatch = res;
      });

      mockDriveList.mockResolvedValue({
        files: [
          {
            id: 'file-1',
            name: `sync_device_${getSyncDeviceId()}.json`,
          },
        ],
      });
      mockDrivePatch.mockImplementation(async () => {
        notifyPatchStarted();
        await patchPromise;
      });

      // Start upload
      const flushPromise = flushPendingSync();
      await patchStartedPromise;

      // Mutation occurs while patch network request is in flight
      notifySyncDirty();

      // Resolve patch network call
      resolvePatch();
      await flushPromise;

      // Because new mutation happened while in flight, dirty flag must remain true
      expect(isSyncDirty()).toBe(true);
      mockDrivePatch.mockReset();
    });

    it('cancels any pending debounce timer when flushPendingSync is called directly', async () => {
      notifySyncDirty(); // schedules 2000ms debounce
      expect(jest.getTimerCount()).toBe(1);

      mockDriveList.mockResolvedValue({ files: [] });
      mockDriveCreate.mockResolvedValue({ id: 'file-created' });

      await flushPendingSync(); // should cancel debounce timer

      expect(jest.getTimerCount()).toBe(0);
      expect(isSyncDirty()).toBe(false);

      // Fast forward 3 seconds: no duplicate sync should run
      mockDriveCreate.mockClear();
      jest.advanceTimersByTime(3000);
      expect(mockDriveCreate).not.toHaveBeenCalled();
    });

    it('syncNow awaits active in-flight sync without throwing false-negative error', async () => {
      notifySyncDirty();
      let resolveFirstCall: () => void = () => {};
      let firstCallStarted: () => void = () => {};
      const firstCallStartedPromise = new Promise<void>(res => {
        firstCallStarted = res;
      });
      const firstCallPromise = new Promise<void>(res => {
        resolveFirstCall = res;
      });

      mockDriveList.mockImplementation(async () => {
        firstCallStarted();
        await firstCallPromise;
        return { files: [] };
      });
      mockDriveCreate.mockResolvedValue({ id: 'new-id' });

      // In-flight sync begins
      const inFlight = triggerStartupPull();
      await firstCallStartedPromise;

      // User triggers syncNow while first sync is in flight
      const syncNowPromise = driveSyncManager.syncNow();

      // Subsequent list calls should resolve immediately
      mockDriveList.mockResolvedValue({ files: [] });
      resolveFirstCall();
      await inFlight;

      await expect(syncNowPromise).resolves.not.toThrow();
      expect(isSyncDirty()).toBe(false);
      expect(driveSyncManager.getStatus()).toBe(SyncStatus.IDLE);
    });
  });

  it('retries pending sync when network reconnects after being offline', async () => {
    mockNetInfoFetch.mockResolvedValue({
      isConnected: false,
      type: 'none',
    });
    notifySyncDirty();

    await flushPendingSync();

    expect(driveSyncManager.getStatus()).toBe(SyncStatus.OFFLINE);
    expect(isSyncDirty()).toBe(true);
    expect(mockNetInfoAddEventListener).toHaveBeenCalledTimes(1);
    expect(netInfoListener).not.toBeNull();

    mockNetInfoFetch.mockResolvedValue({
      isConnected: true,
      type: 'wifi',
    });
    mockDriveList.mockResolvedValue({ files: [] });
    mockDriveCreate.mockResolvedValue({ id: 'reconnected-file-id' });
    mockDrivePatch.mockResolvedValue(undefined);

    netInfoListener?.({ isConnected: true, type: 'wifi' });

    await Promise.resolve();
    await Promise.resolve();
    await new Promise(resolve => {
      jest.useRealTimers();
      setTimeout(resolve, 20);
    });

    expect(mockDriveCreate).toHaveBeenCalledTimes(1);
    expect(isSyncDirty()).toBe(false);
    expect(driveSyncManager.getStatus()).toBe(SyncStatus.IDLE);
  });

  it('rejects syncNow when the Drive API request fails', async () => {
    mockDriveList.mockRejectedValue(new Error('Drive list error: 403'));

    await expect(driveSyncManager.syncNow()).rejects.toThrow(
      'Drive list error: 403',
    );
    expect(driveSyncManager.getStatus()).toBe(SyncStatus.AUTH_REQUIRED);
    expect(isSyncDirty()).toBe(true);
  });
});
