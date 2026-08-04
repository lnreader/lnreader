import { getMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';
import { logger } from '../logger';
import type { LogEntry } from '../types';

const STORAGE_KEY = 'APP_LOG_BUFFER';

describe('logger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    logger.clear();
    MMKVStorage.clearAll();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('records entries in insertion order', () => {
    logger.info('Tag', 'first');
    logger.warn('Tag', 'second');

    const entries = logger.getEntries();
    expect(entries.map(entry => entry.message)).toEqual(['first', 'second']);
    expect(entries[0].level).toBe('info');
    expect(entries[1].level).toBe('warn');
  });

  it('caps the buffer at 500 entries, evicting the oldest first', () => {
    for (let i = 0; i < 505; i++) {
      logger.info('Tag', `entry-${i}`);
    }

    const entries = logger.getEntries();
    expect(entries).toHaveLength(500);
    expect(entries[0].message).toBe('entry-5');
    expect(entries[entries.length - 1].message).toBe('entry-504');
  });

  it('redacts sensitive content at ingest time', () => {
    logger.info('Tag', 'leaked access_token=SUPERSECRET in redirect');

    const [entry] = logger.getEntries();
    expect(entry.message).not.toContain('SUPERSECRET');
    expect(entry.message).toContain('<redacted>');
  });

  it('flushes to MMKV synchronously on error, without waiting for the debounce', () => {
    logger.error('Tag', 'boom');

    const persisted = getMMKVObject<LogEntry[]>(STORAGE_KEY);
    expect(persisted).toHaveLength(1);
    expect(persisted?.[0].message).toBe('boom');
  });

  it('debounces persistence for non-error levels', () => {
    logger.info('Tag', 'info message');
    expect(getMMKVObject<LogEntry[]>(STORAGE_KEY)).toBeUndefined();

    jest.advanceTimersByTime(2000);

    expect(getMMKVObject<LogEntry[]>(STORAGE_KEY)).toHaveLength(1);
  });

  it('clear() empties the buffer and persists the empty state', () => {
    logger.error('Tag', 'boom');
    expect(logger.getEntries()).toHaveLength(1);

    logger.clear();

    expect(logger.getEntries()).toHaveLength(0);
    expect(getMMKVObject<LogEntry[]>(STORAGE_KEY)).toEqual([]);
  });
});
