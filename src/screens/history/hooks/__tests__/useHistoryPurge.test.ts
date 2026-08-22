/**
 * Purge orchestration tests — #1874 review rounds 1-2.
 *
 * Ruling floor (grillmaster, c8a1b11, Ruling 2): at least one real test of
 * the purge orchestration asserting — cancel happens BEFORE file deletion;
 * library removal fires ONLY when inLibrary; non-library novels skip that
 * step; history clear always runs. SRAL blocker 1: one novel's failure must
 * not abort the rest — failures are collected for the caller to toast.
 *
 * Round-2 AMENDMENT (grillmaster ruling, delivered by SRAL): the purge
 * order is cancel → files → LIBRARY (batched) → HISTORY LAST. History
 * deletion is the irreversible step; a library-stage failure must never
 * leave history already gone. Mandatory floor: the amended order assertion
 * below plus the atomicity property (removeFromLibrary rejects ⇒
 * deleteHistory never called for the affected novels).
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
    cancelForNovels: jest.fn().mockResolvedValue(0),
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
      return 0;
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

describe('purge orchestration order (round-2 AMENDED ruling)', () => {
  it('cancel → files → batched library removal → history LAST', async () => {
    const io = makeIo();
    io.getDownloadedChapters.mockImplementation(async () => {
      io.calls.push('probe:1');
      return [{ id: 101 }, { id: 102 }];
    });

    await runPurgeOrchestration([entry(1, { inLibrary: true })], io);

    expect(io.calls[0]).toBe('cancel');
    // Round-2 amendment (grillmaster ruling): history deletion is the
    // irreversible step and runs LAST, only after library removal succeeded.
    expect(io.calls).toEqual([
      'cancel',
      'probe:1',
      'deleteFiles',
      'removeFromLibrary',
      'clearHistory',
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

describe('library-stage atomicity (round-2 AMENDED ruling)', () => {
  it('library failure leaves history intact — the atomicity property itself', async () => {
    const io = makeIo();
    io.removeFromLibrary.mockRejectedValue(new Error('library write failed'));

    const result = await runPurgeOrchestration(
      [entry(40, { inLibrary: true }), entry(41, { inLibrary: true })],
      io,
    );

    // History must NOT have been cleared for the novels whose library step
    // failed — the irreversible step never runs for a blocked novel.
    expect(io.deleteHistory).not.toHaveBeenCalled();
    // Per-novel attribution: no '(library removal)' sentinel — each
    // affected novel is named so the toast can say exactly what is untouched.
    expect(result.failures).toEqual([
      { novelId: 40, novelName: 'Novel 40', error: 'library write failed' },
      { novelId: 41, novelName: 'Novel 41', error: 'library write failed' },
    ]);
    // A novel whose library step failed is NOT purged.
    expect(result.purgedNovels).toBe(0);
  });

  it('library failure: non-library survivors still complete with history cleared', async () => {
    const io = makeIo();
    io.removeFromLibrary.mockRejectedValue(new Error('library write failed'));

    const result = await runPurgeOrchestration(
      [entry(20, { inLibrary: true }), entry(21)],
      io,
    );

    // Novel 20 is blocked by the library stage and keeps its history;
    // novel 21 (not in library) never touches that stage and completes.
    expect(io.deleteHistory).toHaveBeenCalledTimes(1);
    expect(io.deleteHistory).toHaveBeenCalledWith(21);
    expect(result.failures).toEqual([
      { novelId: 20, novelName: 'Novel 20', error: 'library write failed' },
    ]);
    expect(result.purgedNovels).toBe(1);
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

  it('failed novels are excluded from the library-removal batch and keep history', async () => {
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
    // Novel 30 failed before the library stage; its history is never cleared.
    expect(io.deleteHistory).not.toHaveBeenCalledWith(30);
  });
});

describe('scoped cancel contract (grillmaster Ruling 1 + round-2 return contract)', () => {
  it('passes exactly the selected novel ids; io reports legacy-task count', async () => {
    const io = makeIo();
    // Round-2 semantics: cancelForNovels returns a legacy-TASK count.
    io.cancelForNovels.mockResolvedValue(2);

    const result = await runPurgeOrchestration([entry(1), entry(2)], io);

    expect(io.cancelForNovels).toHaveBeenCalledWith([1, 2]);
    // The count passes through honestly — no synthetic per-novel ids.
    expect(result.legacyTaskCount).toBe(2);
  });

  it('zero legacy tasks means zero count', async () => {
    const io = makeIo();
    io.cancelForNovels.mockResolvedValue(0);

    const result = await runPurgeOrchestration([entry(1)], io);

    expect(result.legacyTaskCount).toBe(0);
  });
});
