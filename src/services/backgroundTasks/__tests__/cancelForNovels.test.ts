/**
 * Round-2 fix tests: cancelForNovels return semantics (SRAL blocker 2).
 *
 * Exercises BackgroundTaskQueue.cancelForNovels directly against the
 * native-module mock + a closure-backed MMKV store (the getMMKVObject
 * stub MUST read the same variable setMMKVObject writes — a static []
 * makes refresh() write into a void and every snapshot reads empty).
 *
 * Contract (round-2 verdict): returns the count of LEGACY
 * DOWNLOAD_CHAPTER tasks (those lacking novelId) encountered while
 * cancelling matched tasks — NOT selected-minus-cancelled ids.
 */

import NativeBackgroundTasks from '@modules/native-background-tasks';
import { BackgroundTaskQueue } from '../BackgroundTaskQueue';

let mockStoredTasks: unknown[] = [];

jest.mock('@modules/native-background-tasks', () => ({
  __esModule: true,
  default: {
    complete: jest.fn(),
    enqueue: jest.fn().mockResolvedValue('native-task-1'),
    fail: jest.fn(),
    updateProgress: jest.fn().mockResolvedValue(undefined),
    cancel: jest.fn().mockResolvedValue(undefined),
    getTasks: jest.fn(),
  },
}));

jest.mock('../executeTask', () => ({
  executeBackgroundTask: jest.fn(),
}));

jest.mock('@utils/askForPostNoftificationsPermission', () => ({
  askForPostNotificationsPermission: jest.fn().mockResolvedValue(true),
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(() => mockStoredTasks),
  setMMKVObject: jest.fn((_key: string, value: unknown[]) => {
    mockStoredTasks = value;
  }),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

const mockedNative = NativeBackgroundTasks as jest.Mocked<
  typeof NativeBackgroundTasks
>;

const record = (
  id: string,
  data: Record<string, unknown>,
  state = 'queued',
) => ({
  id,
  type: 'DOWNLOAD_CHAPTER',
  attempt: 0,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  state,
  progress: 0,
  progressText: '',
  title: 'x',
  // refresh() JSON-parses the payload (fromNativeTaskRecord).
  payload: JSON.stringify({ name: 'DOWNLOAD_CHAPTER', data }),
});

beforeEach(() => {
  mockStoredTasks = [];
  jest.clearAllMocks();
});

describe('cancelForNovels return semantics (#1874 round 2)', () => {
  it('returns the LEGACY-TASK COUNT, not selected-minus-cancelled ids', async () => {
    mockedNative.getTasks.mockResolvedValue([
      record('t1', { novelName: 'A', novelId: 1, chapters: [] }),
      record('t2', { novelName: 'Legacy', chapters: [] }),
    ]);

    const queue = new BackgroundTaskQueue();
    await queue.refresh();
    const legacyCount = await queue.cancelForNovels([1, 2]);

    expect(legacyCount).toBe(1);
    expect(NativeBackgroundTasks.cancel).toHaveBeenCalledTimes(1);
    expect(NativeBackgroundTasks.cancel).toHaveBeenCalledWith('t1');
  });

  it('returns 0 — no false-positive toast — when selected novels simply have nothing queued', async () => {
    mockedNative.getTasks.mockResolvedValue([
      record('t3', { novelName: 'B', novelId: 7, chapters: [] }),
    ]);

    const queue = new BackgroundTaskQueue();
    await queue.refresh();
    const legacyCount = await queue.cancelForNovels([2, 3]);

    expect(legacyCount).toBe(0);
    expect(NativeBackgroundTasks.cancel).not.toHaveBeenCalled();
  });

  it('counts every legacy task, cancels none of them', async () => {
    mockedNative.getTasks.mockResolvedValue([
      record('l1', { novelName: 'L1', chapters: [] }),
      record('l2', { novelName: 'L2', chapters: [] }),
    ]);

    const queue = new BackgroundTaskQueue();
    await queue.refresh();
    const legacyCount = await queue.cancelForNovels([1]);

    expect(legacyCount).toBe(2);
    expect(NativeBackgroundTasks.cancel).not.toHaveBeenCalled();
  });
});
