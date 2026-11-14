import type {
  BackgroundTaskMetadata,
  TaskProgressUpdater,
} from '@services/backgroundTasks/contracts';
import { createRestoreProgressReporter } from '../progress';

const createProgressCapture = () => {
  let metadata: BackgroundTaskMetadata = {
    name: 'LOCAL_RESTORE',
    isRunning: true,
    progress: undefined,
    progressText: undefined,
    completionText: 'preserved',
  };
  const updates: BackgroundTaskMetadata[] = [];
  const setMeta: TaskProgressUpdater = transform => {
    metadata = transform(metadata);
    updates.push(metadata);
  };
  return { setMeta, updates };
};

describe('restore progress reporter', () => {
  afterEach(() => {
    jest.useRealTimers();
  });
  it('maps local phases into benchmark-weighted ranges and reaches one at finalize', () => {
    const { setMeta, updates } = createProgressCapture();
    const reporter = createRestoreProgressReporter(setMeta, 'local')!;

    reporter('source', 1, 'copy');
    reporter('extract', 1, 'extract');
    reporter('manifest', 1, 'manifest');
    reporter('novels', 1, 'novels');
    reporter('categories', 1, 'categories');
    reporter('settings', 1, 'settings');
    reporter('plugins', 1, 'plugins');
    reporter('selectedFiles', 1, 'selected files');
    reporter('finalize', 0, 'finishing');
    reporter('finalize', 1, 'done');

    const values = updates.map(update => update.progress!);
    expect(values[0]).toBeCloseTo(0.09);
    expect(values[1]).toBeCloseTo(0.3);
    expect(values[2]).toBeCloseTo(0.302);
    expect(values[3]).toBeCloseTo(0.982);
    expect(values[4]).toBeCloseTo(0.986);
    expect(values[5]).toBeCloseTo(0.988);
    expect(values[6]).toBeCloseTo(0.992);
    expect(values[7]).toBeCloseTo(0.997);
    expect(values[8]).toBeCloseTo(0.997);
    expect(values[9]).toBe(1);
    expect(
      values.every((value, index) => index === 0 || value >= values[index - 1]),
    ).toBe(true);
    expect(updates.every(update => update.completionText === 'preserved')).toBe(
      true,
    );
  });

  it('combines remote retrieval and extraction in the 0.30 source range', () => {
    const { setMeta, updates } = createProgressCapture();
    const reporter = createRestoreProgressReporter(setMeta, 'remote')!;

    reporter('source', 1, 'download');
    reporter('extract', 1, 'download');
    reporter('manifest', 1, 'manifest');

    expect(updates[0].progress).toBeCloseTo(0.3);
    expect(updates[updates.length - 1].progress).toBeCloseTo(0.302);
  });
  it.each(['local', 'remote'] as const)(
    'reserves completion for finalization fraction one for %s restores',
    source => {
      const { setMeta, updates } = createProgressCapture();
      const reporter = createRestoreProgressReporter(setMeta, source)!;

      for (const fraction of [0, 0.25, 0.75, 1 - Number.EPSILON]) {
        reporter('finalize', fraction, `finishing ${fraction}`, true);
      }

      const partialValues = updates.map(update => update.progress!);
      expect(partialValues.every(value => value < 1)).toBe(true);
      expect(
        partialValues.every(
          (value, index) => index === 0 || value >= partialValues[index - 1],
        ),
      ).toBe(true);

      reporter('finalize', 1, 'done', true);
      expect(updates[updates.length - 1].progress).toBe(1);
    },
  );

  it('clamps fractions and keeps progress monotonic across interleaved phases', () => {
    const { setMeta, updates } = createProgressCapture();
    const reporter = createRestoreProgressReporter(setMeta, 'local')!;

    reporter('source', -4, 'start');
    reporter('extract', 2, 'extracted');
    reporter('source', 0, 'interleaved source');
    reporter('manifest', Number.NaN, 'manifest');

    const values = updates.map(update => update.progress!);
    expect(values[0]).toBe(0);
    expect(values[1]).toBeCloseTo(0.3);
    expect(values[2]).toBeCloseTo(0.3);
    expect(values[3]).toBeCloseTo(0.3);
    expect(values.every(value => value >= 0 && value <= 1)).toBe(true);
    expect(
      values.every((value, index) => index === 0 || value >= values[index - 1]),
    ).toBe(true);
  });

  it('throttles ordinary updates but emits phase changes, forced updates, and completion', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const { setMeta, updates } = createProgressCapture();
    const reporter = createRestoreProgressReporter(setMeta, 'local')!;

    reporter('source', 0, 'source');
    reporter('source', 0.2, 'ordinary');
    expect(updates).toHaveLength(1);

    jest.advanceTimersByTime(250);
    reporter('source', 0.2, 'ordinary');
    expect(updates).toHaveLength(2);

    reporter('source', 0.3, 'forced', true);
    reporter('source', 0.3, 'forced', true);
    expect(updates).toHaveLength(3);

    reporter('extract', 0, 'next phase');
    expect(updates).toHaveLength(4);
    reporter('extract', 1, 'next phase complete');
    expect(updates).toHaveLength(5);
  });

  it('does not swallow updater exceptions', () => {
    const setMeta: TaskProgressUpdater = () => {
      throw new Error('metadata update failed');
    };
    const reporter = createRestoreProgressReporter(setMeta, 'local')!;

    expect(() => reporter('source', 0, 'copy')).toThrow(
      'metadata update failed',
    );
  });
});
