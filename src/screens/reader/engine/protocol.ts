import type { ReaderPreferences } from './preferences';

export interface ReaderSection {
  id: number;
  name: string;
}

export interface ReaderLocation {
  chapterId: number;
  fraction: number;
}

export interface ReaderStrings {
  retry: string;
  finished: string;
  nextChapter: string;
  noNextChapter: string;
}

export interface ReaderOpenMessage {
  type: 'open';
  novelName: string;
  novelId: number;
  pluginId: string;
  sections: ReaderSection[];
  start: ReaderLocation;
  preferences: ReaderPreferences;
  assetsUri: string;
  dir: 'ltr' | 'rtl';
  lang?: string;
  customJs: string;
  pluginJs: string;
  /** -1 when unknown. */
  battery: number;
  strings: ReaderStrings;
}

export type NativeToWebMessage =
  | ReaderOpenMessage
  | { type: 'append-sections'; sections: ReaderSection[] }
  | {
      type: 'section-content';
      requestId: number;
      html: string;
      baseUrl?: string;
    }
  | { type: 'section-error'; requestId: number; message: string }
  | { type: 'preferences'; preferences: ReaderPreferences }
  | { type: 'go-to'; location: ReaderLocation }
  | {
      type: 'turn';
      direction: 'next' | 'prev';
      distance?: number;
    }
  | {
      type: 'auto-scroll';
      interval: number;
      distance?: number;
      /** Glide continuously; otherwise jump `distance` every `interval` (default). */
      smooth?: boolean;
    }
  | { type: 'search'; query: string }
  | { type: 'search-step'; direction: 1 | -1 }
  | { type: 'search-clear' }
  | { type: 'tts-start' }
  | { type: 'tts-target'; x: number; y: number }
  | { type: 'tts-target-clear' }
  | { type: 'tts-start-at'; x: number; y: number }
  | { type: 'tts-highlight'; index: number }
  | { type: 'tts-stop' }
  | { type: 'battery'; level: number }
  | { type: 'reload-section'; chapterId: number }
  | {
      type: 'text-edit';
      action: 'remove' | 'replace';
      text: string;
      replacement?: string;
    }
  | { type: 'clear-selection' };

export type WebToNativeMessage =
  | { type: 'ready' }
  | { type: 'request-section'; requestId: number; chapterId: number }
  | {
      type: 'relocate';
      chapterId: number;
      fraction: number;
      /** The chapter counts as read when this reaches 1. */
      endFraction: number;
      /** Paginated only. */
      page?: number;
      pages?: number;
      atStart: boolean;
      atEnd: boolean;
    }
  | { type: 'tap' }
  | { type: 'boundary'; direction: 'next' | 'prev' }
  | { type: 'navigate-chapter'; direction: 'next' | 'prev' }
  | { type: 'search-result'; query: string; current: number; total: number }
  | { type: 'tts-queue'; chapterId: number; utterances: string[] }
  | { type: 'selection'; text: string }
  | { type: 'selection-cleared' }
  | { type: 'open-link'; href: string }
  | { type: 'refresh-section'; chapterId: number }
  | { type: 'interaction' }
  | { type: 'error'; message: string }
  | { type: 'log'; level: 'log' | 'warn' | 'error'; message: string };

type Shape = Record<string, 'string' | 'number' | 'boolean' | 'string[]'>;

const WEB_MESSAGE_SHAPES: Record<WebToNativeMessage['type'], Shape> = {
  ready: {},
  'request-section': { requestId: 'number', chapterId: 'number' },
  relocate: {
    chapterId: 'number',
    fraction: 'number',
    endFraction: 'number',
    atStart: 'boolean',
    atEnd: 'boolean',
  },
  tap: {},
  boundary: { direction: 'string' },
  'navigate-chapter': { direction: 'string' },
  'search-result': { query: 'string', current: 'number', total: 'number' },
  'tts-queue': { chapterId: 'number', utterances: 'string[]' },
  selection: { text: 'string' },
  'selection-cleared': {},
  'open-link': { href: 'string' },
  'refresh-section': { chapterId: 'number' },
  interaction: {},
  error: { message: 'string' },
  log: { level: 'string', message: 'string' },
};

const matches = (value: unknown, kind: Shape[string]) =>
  kind === 'string[]'
    ? Array.isArray(value) && value.every(item => typeof item === 'string')
    : typeof value === kind;

/**
 * Drops anything malformed: plugin scripts share the reader page, so its
 * messages aren't trusted.
 */
export const parseWebMessage = (
  raw: string,
): WebToNativeMessage | undefined => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  const type = record.type;
  if (typeof type !== 'string' || !(type in WEB_MESSAGE_SHAPES)) {
    return undefined;
  }
  const shape = WEB_MESSAGE_SHAPES[type as WebToNativeMessage['type']];
  for (const [key, kind] of Object.entries(shape)) {
    if (!matches(record[key], kind)) {
      return undefined;
    }
  }
  if (
    (type === 'boundary' || type === 'navigate-chapter') &&
    record.direction !== 'next' &&
    record.direction !== 'prev'
  ) {
    return undefined;
  }
  if (
    type === 'relocate' &&
    ((record.page !== undefined && typeof record.page !== 'number') ||
      (record.pages !== undefined && typeof record.pages !== 'number'))
  ) {
    return undefined;
  }
  return data as WebToNativeMessage;
};

export const toInjectedScript = (message: NativeToWebMessage): string =>
  `window.lnReader && window.lnReader.receive(${JSON.stringify(
    message,
  )});true;`;
