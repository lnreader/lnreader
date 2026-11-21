import dayjs from 'dayjs';

import NativeWidgets from '@modules/native-widgets';
import { getString } from '@i18n/translations';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import {
  LIBRARY_SETTINGS,
  type LibrarySettings,
} from '@hooks/persisted/useSettings';
import {
  getWidgetReadDaysFromDb,
  getWidgetReadingFromDb,
  getWidgetUpdatesCountFromDb,
  getWidgetUpdatesFromDb,
} from '@database/queries/WidgetQueries';

const READING_LIMIT = 4;
const UPDATES_LIMIT = 6;
// Enough history for the 7 dots plus a long streak.
const READ_DAYS_WINDOW = 60;

/** Mirrors WidgetSnapshot.kt; every widget renders from this. */
export interface WidgetSnapshot {
  incognito: boolean;
  reading: {
    novelId: number;
    chapterId: number;
    novelName: string;
    chapterName: string;
    chapterNumber: string;
    novelProgress: number | null;
    chapterProgress: number;
    totalChapters: number;
    cover: string | null;
  }[];
  updates: {
    count: number;
    items: {
      novelId: number;
      chapterId: number;
      novelName: string;
      chapterName: string;
      chapterNumber: string;
      updatedAt: number;
      cover: string | null;
    }[];
  };
  readDays: Record<string, number>;
  strings: Record<string, string>;
}

/** Empty when unknown; the widgets then show the chapter name instead. */
const formatChapterNumber = (value: number) =>
  value >= 0
    ? value.toLocaleString(undefined, { maximumFractionDigits: 1 })
    : '';

const resolveChapterNumber = (
  chapterNumber: number | null,
  novelName: string,
  chapterName: string,
) => chapterNumber ?? parseChapterNumber(novelName, chapterName);

/**
 * Native code fills the `{name}` placeholders at render time, so relative
 * values (counts, streaks) never go stale between syncs.
 */
const widgetStrings = (): Record<string, string> => ({
  continueReading: getString('widgets.continueReading'),
  newChapters: getString('widgets.newChapters'),
  resume: getString('widgets.resume'),
  chapter: getString('widgets.chapter', { number: '{number}' }),
  chapterProgress: getString('widgets.chapterProgress', {
    number: '{number}',
    total: '{total}',
    percent: '{percent}',
  }),
  more: getString('widgets.more', { remaining: '{remaining}' }),
  updating: getString('widgets.updating'),
  updatingProgress: getString('widgets.updatingProgress', {
    done: '{done}',
    total: '{total}',
  }),
  update: getString('widgets.update'),
  search: getString('widgets.search'),
  random: getString('widgets.random'),
  downloads: getString('widgets.downloads'),
  chaptersThisWeek: getString('widgets.chaptersThisWeek'),
  streak: getString('widgets.streak', { days: '{days}' }),
  nothingRead: getString('widgets.nothingRead'),
  nothingReadDesc: getString('widgets.nothingReadDesc'),
  browse: getString('widgets.browse'),
  caughtUp: getString('widgets.caughtUp'),
  caughtUpDesc: getString('widgets.caughtUpDesc'),
  openLibrary: getString('widgets.openLibrary'),
  noChaptersThisWeek: getString('widgets.noChaptersThisWeek'),
  incognito: getString('widgets.incognito'),
  incognitoDesc: getString('widgets.incognitoDesc'),
  updateNotificationTitle: getString('notifications.UPDATE_LIBRARY'),
  updateNotificationDescription: getString('common.preparing'),
});

export const buildWidgetSnapshot = async (): Promise<WidgetSnapshot> => {
  const incognito = Boolean(
    getMMKVObject<LibrarySettings>(LIBRARY_SETTINGS)?.incognitoMode,
  );
  const strings = widgetStrings();

  // Incognito hides reading history everywhere, including the home screen:
  // nothing about the library leaves the app while it is on.
  if (incognito) {
    return {
      incognito,
      reading: [],
      updates: { count: 0, items: [] },
      readDays: {},
      strings,
    };
  }

  const [reading, updates, updatesCount, readDays] = await Promise.all([
    getWidgetReadingFromDb(READING_LIMIT),
    getWidgetUpdatesFromDb(UPDATES_LIMIT),
    getWidgetUpdatesCountFromDb(),
    getWidgetReadDaysFromDb(READ_DAYS_WINDOW),
  ]);

  return {
    incognito,
    reading: reading.map(row => {
      const number = resolveChapterNumber(
        row.chapterNumber,
        row.novelName,
        row.chapterName,
      );
      const totalChapters = row.totalChapters ?? 0;
      return {
        novelId: row.novelId,
        chapterId: row.chapterId,
        novelName: row.novelName,
        chapterName: row.chapterName,
        chapterNumber: formatChapterNumber(number),
        novelProgress:
          totalChapters > 0 && number > 0
            ? Math.min(1, number / totalChapters)
            : null,
        chapterProgress: Math.min(1, Math.max(0, (row.progress ?? 0) / 100)),
        totalChapters,
        cover: row.novelCover ?? null,
      };
    }),
    updates: {
      count: updatesCount,
      items: updates.map(row => ({
        novelId: row.novelId,
        chapterId: row.chapterId,
        novelName: row.novelName,
        chapterName: row.chapterName,
        chapterNumber: formatChapterNumber(
          resolveChapterNumber(
            row.chapterNumber,
            row.novelName,
            row.chapterName,
          ),
        ),
        updatedAt: row.updatedTime ? dayjs(row.updatedTime).valueOf() : 0,
        cover: row.novelCover ?? null,
      })),
    },
    readDays: Object.fromEntries(
      readDays
        .filter(row => Boolean(row.day))
        .map(row => [row.day, row.chapters]),
    ),
    strings,
  };
};

/**
 * Pushes fresh data to the home screen widgets. Without [force] it is a no-op
 * (one binder call) when none are placed, so it is safe to call after any
 * library change. Forced syncs (app start, app backgrounded) store a snapshot
 * regardless, so a widget added later renders real data immediately instead
 * of waiting for the next app launch.
 */
export const syncWidgets = async ({ force = false } = {}) => {
  if (!NativeWidgets) {
    return;
  }
  try {
    if (!force && !(await NativeWidgets.hasWidgets())) {
      return;
    }
    const snapshot = await buildWidgetSnapshot();
    await NativeWidgets.setSnapshot(JSON.stringify(snapshot));
  } catch {
    // Widgets are best effort; a failed sync keeps the previous snapshot.
  }
};

let syncTimer: ReturnType<typeof setTimeout> | undefined;

/** Coalesces bursts of database writes (e.g. reader progress) into one sync. */
export const scheduleWidgetSync = (delayMs = 3000) => {
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    syncWidgets();
  }, delayMs);
};

/** Drives the New Chapters spinner and "Updating · 12/48" label. */
export const reportLibraryUpdateProgress = (
  running: boolean,
  done = 0,
  total = 0,
) => {
  NativeWidgets?.setLibraryUpdateState(running, done, total).catch(() => {});
};
