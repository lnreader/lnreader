import { GoogleSignin } from '@react-native-google-signin/google-signin';
import NetInfo from '@react-native-community/netinfo';
import { list, create, patch, getMedia } from '@api/drive/request';
import { MMKVStorage, getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { APP_SETTINGS, type AppSettings } from '@hooks/persisted/useSettings';
import {
  queryActiveSyncEntities,
  mergeRemoteSyncPayload,
} from '@database/queries/SyncQueries';
import {
  SyncStatus,
  DRIVE_SYNC_DEVICE_ID,
  DRIVE_SYNC_DIRTY,
  DRIVE_SYNC_DIRTY_TOKEN,
  DRIVE_SYNC_WATERMARKS,
  type SyncDevicePayload,
} from './types';
import type { DriveFile } from '@api/drive/types';

const SIXTY_DAYS_MS = 60 * 24 * 60 * 60 * 1000;

interface Watermarks {
  [peerDeviceId: string]: string;
}

let currentStatus: SyncStatus = SyncStatus.IDLE;
const statusListeners = new Set<(status: SyncStatus) => void>();
let isSyncing = false;
let inFlightSync: Promise<void> | null = null;
let lastSyncError: unknown;
let scheduledSync: ReturnType<typeof setTimeout> | undefined;
let netInfoUnsubscribe: (() => void) | null = null;

const isNetworkAllowedForState = (
  state: { isConnected?: boolean | null; type?: string },
  wifiOnly: boolean,
): boolean => {
  if (!state.isConnected) return false;
  if (wifiOnly && state.type !== 'wifi') return false;
  return true;
};

const clearNetworkRetryListener = (): void => {
  if (netInfoUnsubscribe) {
    netInfoUnsubscribe();
    netInfoUnsubscribe = null;
  }
};

const ensureNetworkRetryListener = (): void => {
  if (netInfoUnsubscribe) return;
  if (typeof NetInfo.addEventListener !== 'function') return;
  netInfoUnsubscribe = NetInfo.addEventListener(state => {
    const { enabled, wifiOnly } = getSyncSettings();
    if (!enabled || !isSyncDirty()) {
      clearNetworkRetryListener();
      return;
    }
    if (isNetworkAllowedForState(state, wifiOnly)) {
      clearNetworkRetryListener();
      void flushPendingSync();
    }
  });
};

const createDeviceId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const randomNibble = Math.floor(Math.random() * 16);
    const value = character === 'x' ? randomNibble : (randomNibble & 0x3) | 0x8;
    return value.toString(16);
  });

export const getSyncDeviceId = (): string => {
  let deviceId = MMKVStorage.getString(DRIVE_SYNC_DEVICE_ID);
  if (!deviceId) {
    deviceId = createDeviceId();
    MMKVStorage.set(DRIVE_SYNC_DEVICE_ID, deviceId);
  }
  return deviceId;
};

export const getSyncStatus = (): SyncStatus => currentStatus;

export const setSyncStatus = (status: SyncStatus): void => {
  currentStatus = status;
  for (const listener of statusListeners) {
    try {
      listener(status);
    } catch {
      // listener error ignored
    }
  }
};

export const addSyncStatusListener = (
  listener: (status: SyncStatus) => void,
): (() => void) => {
  statusListeners.add(listener);
  return () => statusListeners.delete(listener);
};

export const notifySyncDirty = (): void => {
  const nextToken = (MMKVStorage.getNumber?.(DRIVE_SYNC_DIRTY_TOKEN) ?? 0) + 1;
  MMKVStorage.set(DRIVE_SYNC_DIRTY, true);
  MMKVStorage.set(DRIVE_SYNC_DIRTY_TOKEN, nextToken);
  if (!getSyncSettings().enabled) return;

  if (scheduledSync) clearTimeout(scheduledSync);
  scheduledSync = setTimeout(() => {
    scheduledSync = undefined;
    void flushPendingSync();
  }, 2000);
};

export const getDirtyToken = (): number => {
  return MMKVStorage.getNumber?.(DRIVE_SYNC_DIRTY_TOKEN) ?? 0;
};

export const isSyncDirty = (): boolean => {
  return MMKVStorage.getBoolean(DRIVE_SYNC_DIRTY) ?? false;
};

export const clearSyncDirty = (): void => {
  MMKVStorage.set(DRIVE_SYNC_DIRTY, false);
};

const getWatermarks = (): Watermarks => {
  return getMMKVObject<Watermarks>(DRIVE_SYNC_WATERMARKS) ?? {};
};

const pruneStaleWatermarks = (watermarks: Watermarks): Watermarks => {
  const now = Date.now();
  const cleaned: Watermarks = {};
  for (const [peerId, timestamp] of Object.entries(watermarks)) {
    const ms = new Date(timestamp).getTime();
    if (!isNaN(ms) && now - ms <= SIXTY_DAYS_MS) {
      cleaned[peerId] = timestamp;
    }
  }
  return cleaned;
};

const setPeerWatermark = (peerDeviceId: string, modifiedTime: string): void => {
  const current = pruneStaleWatermarks(getWatermarks());
  current[peerDeviceId] = modifiedTime;
  setMMKVObject(DRIVE_SYNC_WATERMARKS, current);
};

const isStaleFile = (modifiedTime?: string): boolean => {
  if (!modifiedTime) return false;
  const fileMs = new Date(modifiedTime).getTime();
  if (isNaN(fileMs)) return false;
  return Date.now() - fileMs > SIXTY_DAYS_MS;
};

const getSyncSettings = () => {
  const settings = getMMKVObject<AppSettings>(APP_SETTINGS);
  return {
    enabled: settings?.driveSyncEnabled ?? false,
    wifiOnly: settings?.driveSyncWifiOnly ?? true,
    lastTime: settings?.driveSyncLastTime,
  };
};

const updateLastSyncTime = (time: number) => {
  const settings = getMMKVObject<AppSettings>(APP_SETTINGS);
  if (settings) {
    setMMKVObject(APP_SETTINGS, {
      ...settings,
      driveSyncLastTime: time,
    });
  }
};

const checkNetworkAllowsSync = async (wifiOnly: boolean): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    if (!state.isConnected) {
      setSyncStatus(SyncStatus.OFFLINE);
      return false;
    }
    if (wifiOnly && state.type !== 'wifi') {
      return false;
    }
    return true;
  } catch {
    return true;
  }
};

const checkGoogleAuth = async (): Promise<boolean> => {
  try {
    const isSignedIn = await GoogleSignin.hasPreviousSignIn();
    if (!isSignedIn) {
      setSyncStatus(SyncStatus.AUTH_REQUIRED);
      return false;
    }
    const tokens = await GoogleSignin.getTokens();
    if (!tokens.accessToken) {
      setSyncStatus(SyncStatus.AUTH_REQUIRED);
      return false;
    }
    return true;
  } catch (error: any) {
    if (
      error?.code === 'SIGN_IN_REQUIRED' ||
      error?.status === 401 ||
      error?.status === 403
    ) {
      setSyncStatus(SyncStatus.AUTH_REQUIRED);
    }
    return false;
  }
};

const executeUpload = async (): Promise<void> => {
  const snapshotToken = getDirtyToken();
  const deviceId = getSyncDeviceId();
  const entities = await queryActiveSyncEntities();
  const now = Date.now();

  const payload: SyncDevicePayload = {
    version: 1,
    deviceId,
    lastUpdated: now,
    novels: entities.novels,
    chapters: entities.chapters,
    categories: entities.categories,
  };

  const fileName = `sync_device_${deviceId}.json`;
  const searchRes = await list({
    spaces: 'appDataFolder',
    q: `name = '${fileName}' and trashed = false`,
    fields: 'nextPageToken, files(id, name, modifiedTime)',
  });

  const existingFile = searchRes.files?.[0];

  if (existingFile) {
    await patch(existingFile.id, payload);
  } else {
    const newFile = await create({
      metadata: {
        name: fileName,
        mimeType: 'application/json',
        parents: ['appDataFolder'],
      },
    });
    await patch(newFile.id, payload);
  }

  if (getDirtyToken() <= snapshotToken) {
    clearSyncDirty();
  } else {
    // Mutations arrived while network upload was in flight;
    // preserve dirty flag and schedule debounced flush
    if (!scheduledSync && getSyncSettings().enabled) {
      scheduledSync = setTimeout(() => {
        scheduledSync = undefined;
        void flushPendingSync();
      }, 2000);
    }
  }

  updateLastSyncTime(now);
  setSyncStatus(SyncStatus.IDLE);
};

export const flushPendingSync = async (): Promise<void> => {
  if (scheduledSync) {
    clearTimeout(scheduledSync);
    scheduledSync = undefined;
  }

  const { enabled, wifiOnly } = getSyncSettings();
  if (!enabled) {
    clearNetworkRetryListener();
    return;
  }

  const allowed = await checkNetworkAllowsSync(wifiOnly);
  if (!allowed) {
    if (isSyncDirty()) {
      ensureNetworkRetryListener();
    }
    return;
  }
  clearNetworkRetryListener();

  const authOk = await checkGoogleAuth();
  if (!authOk) return;

  if (isSyncing) return;
  isSyncing = true;
  lastSyncError = undefined;
  setSyncStatus(SyncStatus.SYNCING);

  const promise = (async () => {
    try {
      await executeUpload();
    } catch (error: any) {
      lastSyncError = error;
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        setSyncStatus(SyncStatus.AUTH_REQUIRED);
      } else {
        setSyncStatus(SyncStatus.ERROR);
      }
    } finally {
      isSyncing = false;
      inFlightSync = null;
    }
  })();

  inFlightSync = promise;
  await promise;
};

export const triggerStartupPull = async (): Promise<void> => {
  const { enabled, wifiOnly } = getSyncSettings();
  if (!enabled) {
    clearNetworkRetryListener();
    return;
  }

  const allowed = await checkNetworkAllowsSync(wifiOnly);
  if (!allowed) {
    if (isSyncDirty()) {
      ensureNetworkRetryListener();
    }
    return;
  }
  clearNetworkRetryListener();

  const authOk = await checkGoogleAuth();
  if (!authOk) return;

  if (isSyncing) return;
  isSyncing = true;
  lastSyncError = undefined;
  setSyncStatus(SyncStatus.SYNCING);

  const promise = (async () => {
    try {
      const deviceId = getSyncDeviceId();
      const myFileName = `sync_device_${deviceId}.json`;

      const files: DriveFile[] = [];
      let pageToken: string | undefined = undefined;
      do {
        const searchRes = await list({
          spaces: 'appDataFolder',
          q: `name contains 'sync_device_' and trashed = false`,
          fields: 'nextPageToken, files(id, name, modifiedTime)',
          pageToken,
        });
        if (searchRes.files) {
          files.push(...searchRes.files);
        }
        pageToken = searchRes.nextPageToken;
      } while (pageToken);

      const watermarks = pruneStaleWatermarks(getWatermarks());
      setMMKVObject(DRIVE_SYNC_WATERMARKS, watermarks);

      for (const file of files) {
        if (file.name === myFileName) continue;
        if (
          !file.name.startsWith('sync_device_') ||
          !file.name.endsWith('.json')
        ) {
          continue;
        }
        if (isStaleFile(file.modifiedTime)) continue;

        const peerDeviceId = file.name
          .replace('sync_device_', '')
          .replace('.json', '');

        const lastMergedTime = watermarks[peerDeviceId];
        const remoteModifiedTime = file.modifiedTime ?? '';

        if (
          !lastMergedTime ||
          (remoteModifiedTime && remoteModifiedTime > lastMergedTime)
        ) {
          const payload = await getMedia<SyncDevicePayload>(file.id);
          if (payload && payload.version === 1) {
            await mergeRemoteSyncPayload(payload);
            if (remoteModifiedTime) {
              setPeerWatermark(peerDeviceId, remoteModifiedTime);
            }
          }
        }
      }

      if (isSyncDirty()) {
        if (scheduledSync) {
          clearTimeout(scheduledSync);
          scheduledSync = undefined;
        }
        await executeUpload();
      } else {
        setSyncStatus(SyncStatus.IDLE);
      }
    } catch (error: any) {
      lastSyncError = error;
      if (error?.message?.includes('401') || error?.message?.includes('403')) {
        setSyncStatus(SyncStatus.AUTH_REQUIRED);
      } else {
        setSyncStatus(SyncStatus.ERROR);
      }
    } finally {
      isSyncing = false;
      inFlightSync = null;
    }
  })();

  inFlightSync = promise;
  await promise;
};

export const syncNow = async (): Promise<void> => {
  lastSyncError = undefined;
  notifySyncDirty();
  if (scheduledSync) {
    clearTimeout(scheduledSync);
    scheduledSync = undefined;
  }

  if (inFlightSync) {
    try {
      await inFlightSync;
    } catch {
      // Ignore prior in-flight error; proceed to this sync attempt
    }
  }

  await triggerStartupPull();

  if (lastSyncError) throw lastSyncError;
  if (currentStatus === SyncStatus.OFFLINE) {
    throw new Error('Drive sync is unavailable while offline.');
  }
  if (currentStatus === SyncStatus.AUTH_REQUIRED) {
    throw new Error('Google Drive sign-in is required.');
  }
  if (currentStatus === SyncStatus.ERROR) {
    throw new Error('Google Drive sync failed.');
  }

  if (isSyncDirty()) {
    await flushPendingSync();
  }

  if (lastSyncError) throw lastSyncError;
  if (isSyncDirty()) {
    throw new Error(
      'Drive sync did not complete. Check your connection and Wi-Fi setting.',
    );
  }
};

export const driveSyncManager = {
  getDeviceId: getSyncDeviceId,
  getStatus: getSyncStatus,
  notifySyncDirty,
  getDirtyToken,
  isSyncDirty,
  clearSyncDirty,
  flushPendingSync,
  triggerStartupPull,
  syncNow,
  addSyncStatusListener,
};
