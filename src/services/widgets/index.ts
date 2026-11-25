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
  getWidgetReadDatesFromDb,
  getWidgetReadDaysFromDb,
  getWidgetReadingFromDb,
  getWidgetUpdatesCountFromDb,
  getWidgetUpdatesFromDb,
} from '@database/queries/WidgetQueries';

const READING_LIMIT = 4;
const UPDATES_LIMIT = 6;
// The 7 activity dots; the streak is computed from the full history.
const READ_DAYS_WINDOW = 7;

/** Mirrors WidgetSnapshot.kt; every widget renders from this. */
export interface WidgetSnapshot {
  incognito: boolean;
  reading: {
    novelId: number;
    chapterId: number;
    novelName: string;
    chapterName: string;
    chapterNumber: string;
    /** Place in the novel's reading order over its chapter count. */
    novelProgress: number | null;
    /**
     * Whether "Ch. {number} of {total}" reads correctly, i.e. the source's
     * chapter number is also the chapter's place in the novel.
     */
    showTotal: boolean;
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
  /** Consecutive reading days ending on `lastDay` (`YYYY-MM-DD`). */
  streak: { days: number; lastDay: string } | null;
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
  chapterPercent: getString('widgets.chapterPercent', {
    number: '{number}',
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

/**
 * Length of the run of consecutive days ending on the most recent one.
 * Native code decides at render time whether that run is still alive
 * (last day is today or yesterday), so the widget stays right past midnight.
 */
export const computeReadingStreak = (
  datesNewestFirst: string[],
): WidgetSnapshot['streak'] => {
  const [lastDay] = datesNewestFirst;
  if (!lastDay) {
    return null;
  }
  let days = 1;
  let expected = dayjs(lastDay).subtract(1, 'day');
  for (const date of datesNewestFirst.slice(1)) {
    if (date !== expected.format('YYYY-MM-DD')) {
      break;
    }
    days++;
    expected = expected.subtract(1, 'day');
  }
  return { days, lastDay };
};

const isIncognito = () =>
  Boolean(getMMKVObject<LibrarySettings>(LIBRARY_SETTINGS)?.incognitoMode);

export const buildWidgetSnapshot = async (): Promise<WidgetSnapshot> => {
  const incognito = isIncognito();
  const strings = widgetStrings();

  // Incognito hides reading history everywhere, including the home screen:
  // nothing about the library leaves the app while it is on.
  if (incognito) {
    return {
      incognito,
      reading: [],
      updates: { count: 0, items: [] },
      readDays: {},
      streak: null,
      strings,
    };
  }

  const [reading, updates, updatesCount, readDays, readDates] =
    await Promise.all([
      getWidgetReadingFromDb(READING_LIMIT),
      getWidgetUpdatesFromDb(UPDATES_LIMIT),
      getWidgetUpdatesCountFromDb(),
      getWidgetReadDaysFromDb(READ_DAYS_WINDOW),
      getWidgetReadDatesFromDb(),
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
      const position = row.chapterPosition ?? 0;
      const hasProgress = totalChapters > 0 && position > 0;
      return {
        novelId: row.novelId,
        chapterId: row.chapterId,
        novelName: row.novelName,
        chapterName: row.chapterName,
        chapterNumber: formatChapterNumber(number),
        novelProgress: hasProgress
          ? Math.min(1, position / totalChapters)
          : null,
        showTotal: hasProgress && number === position,
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
    streak: computeReadingStreak(readDates),
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
const publishSnapshot = async (force: boolean) => {
  if (!NativeWidgets) {
    return;
  }
  try {
    if (!force && !(await NativeWidgets.hasWidgets())) {
      return;
    }
    let snapshot = await buildWidgetSnapshot();
    // Incognito may have been switched on while the queries ran. Never
    // publish history captured before that.
    if (snapshot.incognito !== isIncognito()) {
      snapshot = await buildWidgetSnapshot();
    }
    await NativeWidgets.setSnapshot(JSON.stringify(snapshot));
  } catch {
    // Widgets are best effort; a failed sync keeps the previous snapshot.
  }
};

// Syncs run one at a time, in call order, so an older snapshot can never be
// published after a newer one (e.g. one built just before incognito was on).
let syncQueue: Promise<void> = Promise.resolve();

export const syncWidgets = ({ force = false } = {}): Promise<void> => {
  syncQueue = syncQueue.then(() => publishSnapshot(force));
  return syncQueue;
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
