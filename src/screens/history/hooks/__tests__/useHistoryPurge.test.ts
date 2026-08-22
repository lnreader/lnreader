/**
 * Purge orchestration tests — #1874 review round 1.
 *
 * Ruling floor (grillmaster, c8a1b11, Ruling 2): at least one real test of
 * the purge orchestration asserting — cancel happens BEFORE file deletion;
 * library removal fires ONLY when inLibrary; non-library novels skip that
 * step; history clear always runs. SRAL blocker 1: one novel's failure must
 * not abort the rest — failures are collected for the caller to toast.
 *
 * Targets the pure orchestration exported from useHistoryPurge.ts
 * (runPurgeOrchestration): every primitive arrives via an injected `io`
 * object, so no jest.mock factories, no React import chain, no RN harness
 * dependencies. Runs under the `rn` jest project (the `db` project's roots
 * lock src/database; placement interpretation flagged to grillmaster in
 * the delta report).
 */

import {
  runPurgeOrchestration,
  type OrchestrationEntry,
} from '../useHistoryPurge';

// Module-level mocks per TESTING.md: the hook file's static import chain
// (via @hooks/persisted → useTheme → @pchmn/expo-material3-theme) ships
// raw ESM that the rn jest transform does not process; mocking the heavy
// modules here keeps this suite node-pure. The orchestration itself needs
// none of these — they exist only so the module under test can load.
jest.mock('@hooks/persisted', () => ({
  useDownload: () => ({ downloadQueue: [] }),
}));
jest.mock('@i18n/translations', () => ({
  getString: jest.fn(key => key),
}));
jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));
jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: {
    cancelForNovels: jest.fn().mockResolvedValue([]),
    cancelByType: jest.fn().mockResolvedValue(undefined),
    enqueueSilently: jest.fn(),
  },
}));

interface TestIo {
  calls: string[];
  cancelForNovels: jest.Mock;
  getDownloadedChapters: jest.Mock;
  deleteChaptersFiles: jest.Mock;
  deleteHistory: jest.Mock;
  removeFromLibrary: jest.Mock;
}

const makeIo = (): TestIo => {
  const calls: string[] = [];
  return {
    calls,
    cancelForNovels: jest.fn(async () => {
      calls.push('cancel');
      return [];
    }),
    getDownloadedChapters: jest.fn(async (novelId: number) => {
      calls.push(`probe:${novelId}`);
      return [];
    }),
    deleteChaptersFiles: jest.fn(async () => {
      calls.push('deleteFiles');
    }),
    deleteHistory: jest.fn(async () => {
      calls.push('clearHistory');
    }),
    removeFromLibrary: jest.fn(async () => {
      calls.push('removeFromLibrary');
    }),
  };
};

const entry = (
  novelId: number,
  overrides: Partial<OrchestrationEntry> = {},
): OrchestrationEntry => ({
  novelId,
  pluginId: overrides.pluginId ?? `p${novelId}`,
  inLibrary: overrides.inLibrary ?? false,
  novelName: overrides.novelName ?? `Novel ${novelId}`,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('purge orchestration order (#1874 rulings round 1)', () => {
  it('cancels queued downloads BEFORE deleting files; library removal batched AFTER the loop', async () => {
    const io = makeIo();
    io.getDownloadedChapters.mockImplementation(async () => {
      io.calls.push('probe:1');
      return [{ id: 101 }, { id: 102 }];
    });

    await runPurgeOrchestration([entry(1, { inLibrary: true })], io);

    expect(io.calls[0]).toBe('cancel');
    expect(io.calls).toEqual([
      'cancel',
      'probe:1',
      'deleteFiles',
      'clearHistory',
      'removeFromLibrary',
    ]);
    expect(io.deleteChaptersFiles).toHaveBeenCalledWith('p1', 1, [101, 102]);
    expect(io.removeFromLibrary).toHaveBeenCalledTimes(1);
    expect(io.removeFromLibrary).toHaveBeenCalledWith([1]);
  });

  it('skips library removal for non-library novels but always clears history', async () => {
    const io = makeIo();

    const result = await runPurgeOrchestration(
      [entry(2, { inLibrary: false }), entry(3, { inLibrary: true })],
      io,
    );

    expect(
      io.deleteHistory.mock.calls.map((call: unknown[]) => call[0]),
    ).toEqual([2, 3]);
    expect(io.removeFromLibrary).toHaveBeenCalledTimes(1);
    expect(io.removeFromLibrary).toHaveBeenCalledWith([3]);
    expect(result.purgedNovels).toBe(2);
    expect(result.failures).toEqual([]);
  });

  it('deletes files only when downloads exist', async () => {
    const io = makeIo();
    io.getDownloadedChapters.mockImplementation(async (novelId: number) =>
      novelId === 4 ? [{ id: 7 }] : [],
    );

    await runPurgeOrchestration(
      [entry(4, { inLibrary: true }), entry(5, { inLibrary: true })],
      io,
    );

    expect(io.deleteChaptersFiles).toHaveBeenCalledTimes(1);
    expect(io.deleteChaptersFiles).toHaveBeenCalledWith('p4', 4, [7]);
    expect(io.removeFromLibrary).toHaveBeenCalledWith([4, 5]);
  });
});

describe('per-novel error isolation (SRAL blocker 1 / spec R4)', () => {
  it('one novel failing does not abort the rest; failures are collected', async () => {
    const io = makeIo();
    io.getDownloadedChapters.mockImplementation(async (novelId: number) => {
      if (novelId === 10) {
        throw new Error('db locked');
      }
      return [];
    });

    const result = await runPurgeOrchestration(
      [
        entry(10),
        entry(11, { inLibrary: true }),
        entry(12, { inLibrary: true }),
      ],
      io,
    );

    expect(result.purgedNovels).toBe(2);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].novelId).toBe(10);
    expect(result.failures[0].error).toBe('db locked');
    // Failed novels are excluded from the library-removal batch (R4).
    expect(io.removeFromLibrary).toHaveBeenCalledWith([11, 12]);
  });

  it('batched library-removal failure is attributed without losing completed purges', async () => {
    const io = makeIo();
    io.removeFromLibrary.mockRejectedValue(new Error('library write failed'));

    const result = await runPurgeOrchestration(
      [entry(20, { inLibrary: true }), entry(21)],
      io,
    );

    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].novelName).toBe('(library removal)');
    expect(result.purgedNovels).toBe(1);
  });

  it('failed novels are excluded from the library-removal batch', async () => {
    const io = makeIo();
    io.getDownloadedChapters.mockImplementation(async (novelId: number) => {
      if (novelId === 30) {
        throw new Error('boom');
      }
      return [];
    });

    await runPurgeOrchestration(
      [entry(30, { inLibrary: true }), entry(31, { inLibrary: true })],
      io,
    );

    expect(io.removeFromLibrary).toHaveBeenCalledWith([31]);
  });
});

describe('scoped cancel contract (grillmaster Ruling 1)', () => {
  it('passes exactly the selected novel ids and surfaces unattributable tasks', async () => {
    const io = makeIo();
    io.cancelForNovels.mockResolvedValue([99]);

    const result = await runPurgeOrchestration([entry(1), entry(2)], io);

    expect(io.cancelForNovels).toHaveBeenCalledWith([1, 2]);
    expect(result.unmatchedQueuedNovelIds).toEqual([99]);
  });
});
