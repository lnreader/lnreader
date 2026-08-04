import { getMMKVObject, setMMKVObject } from '@utils/mmkv/mmkv';
import { redact } from './redact';
import { LogEntry, LogLevel } from './types';

const STORAGE_KEY = 'APP_LOG_BUFFER';
const MAX_ENTRIES = 500;
const MAX_BYTES = 256 * 1024;
const FLUSH_DEBOUNCE_MS = 2000;

let entries: LogEntry[] = [];
let hydrated = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function hydrate() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  entries = getMMKVObject<LogEntry[]>(STORAGE_KEY) ?? [];
}

function trim() {
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES);
  }
  while (entries.length > 0 && JSON.stringify(entries).length > MAX_BYTES) {
    entries.shift();
  }
}

function persist() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = undefined;
  }
  setMMKVObject(STORAGE_KEY, entries);
}

function schedulePersist() {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = undefined;
    setMMKVObject(STORAGE_KEY, entries);
  }, FLUSH_DEBOUNCE_MS);
}

function devLog(
  level: LogLevel,
  tag: string,
  message: string,
  error?: unknown,
) {
  if (!__DEV__) {
    return;
  }
  switch (level) {
    case 'error':
      // eslint-disable-next-line no-console
      console.error(`[${tag}]`, message, error ?? '');
      break;
    case 'warn':
      // eslint-disable-next-line no-console
      console.warn(`[${tag}]`, message, error ?? '');
      break;
    default:
      // eslint-disable-next-line no-console
      console.log(`[${tag}]`, message);
      break;
  }
}

function push(level: LogLevel, tag: string, message: string, error?: unknown) {
  hydrate();

  const stack =
    error instanceof Error && error.stack ? redact(error.stack) : undefined;

  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    tag,
    message: redact(message),
    stack,
  };

  entries.push(entry);
  trim();
  devLog(level, tag, message, error);

  if (level === 'error') {
    persist();
  } else {
    schedulePersist();
  }
}

export const logger = {
  debug: (tag: string, message: string) => push('debug', tag, message),
  info: (tag: string, message: string) => push('info', tag, message),
  warn: (tag: string, message: string, error?: unknown) =>
    push('warn', tag, message, error),
  error: (tag: string, message: string, error?: unknown) =>
    push('error', tag, message, error),
  getEntries(): LogEntry[] {
    hydrate();
    return [...entries];
  },
  clear() {
    hydrate();
    entries = [];
    persist();
  },
};
