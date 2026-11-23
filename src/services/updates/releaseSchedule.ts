/**
 * Release prediction for "Smart update".
 *
 * Ported from Mihon's ReleaseSchedule, ReleasePattern and FetchInterval
 * (https://github.com/mihonapp/mihon, Apache License 2.0). Days are local
 * calendar days, held as whole days since 1970-01-01 so the arithmetic is
 * free of time zones and DST.
 */
import dayjs from 'dayjs';

export type Day = number;

export const MAX_INTERVAL = 28;

const DEFAULT_INTERVAL = 7;
const HIATUS_CYCLES = 4;
const MIN_RELEASES = 3;
const FEW_CHAPTERS = 8;
const FEW_CHAPTERS_RELEASES = 3;
const RECENT_RELEASES = 10;
const PHASE_RELEASES = 5;

const PATTERN_MIN_RELEASES = 4;
const MAX_WEEKDAYS = 3;
const COVERAGE = 0.8;
const DAY_OF_MONTH_TOLERANCE = 3;
const BATCH_HISTORY = 40;
const BATCH_GAP = 2;
const BATCHES = 6;
const MIN_BATCHES = 3;
export const LAST_WEEK = -1;

const MS_PER_DAY = 86_400_000;
// Patterns always produce a day within a few months; this only guards bad input.
const MAX_STEPS = 1000;

const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];

export const dayFromYmd = (year: number, month: number, day: number): Day =>
  Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);

export const ymd = (day: Day) => {
  const date = new Date(day * MS_PER_DAY);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
};

/** ISO day of the week: 1 = Monday … 7 = Sunday. 1970-01-01 was a Thursday. */
export const dayOfWeek = (day: Day) => mod(day + 3, 7) + 1;

export const parseDay = (value: string): Day => {
  const [year, month, day] = value.split('-').map(Number);
  return dayFromYmd(year, month, day);
};

export const formatDay = (day: Day) => {
  const { year, month, day: d } = ymd(day);
  return `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(
    2,
    '0',
  )}`;
};

export const toLocalDay = (date: Date | dayjs.Dayjs): Day => {
  const d = dayjs(date);
  return dayFromYmd(d.year(), d.month() + 1, d.date());
};

/** The instant the local [day] starts, as stored in Novel.nextUpdate. */
export const startOfLocalDay = (day: Day): Date => {
  const { year, month, day: d } = ymd(day);
  return new Date(year, month - 1, d);
};

/**
 * The local day of a stored date. Plugins must give releaseTime as
 * "YYYY-MM-DD" or an ISO string; anything else is ignored.
 */
export const parseStoredDay = (value?: string | null): Day | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}/.test(value)) {
    return undefined;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? toLocalDay(parsed) : undefined;
};

const firstOfMonth = (day: Day) => {
  const { year, month } = ymd(day);
  return dayFromYmd(year, month, 1);
};
const plusMonths = (first: Day, months: number) => {
  const { year, month } = ymd(first);
  return dayFromYmd(year, month + months, 1);
};
const lastOfMonth = (day: Day) => plusMonths(firstOfMonth(day), 1) - 1;

export type ReleasePattern =
  | { kind: 'everyDays'; days: number; onSchedule: Day }
  | { kind: 'weekdays'; days: number[] }
  | { kind: 'batches'; every: number; onSchedule: Day; length: number }
  | { kind: 'daysOfMonth'; days: number[] }
  | { kind: 'weekdayOfMonth'; week: number; dayOfWeek: number };

const monthlyDaysIn = (pattern: ReleasePattern, first: Day): Day[] => {
  if (pattern.kind === 'daysOfMonth') {
    const lastDay = ymd(lastOfMonth(first)).day;
    return [
      ...new Set(pattern.days.map(d => first + Math.min(d, lastDay) - 1)),
    ];
  }
  if (pattern.kind === 'weekdayOfMonth') {
    if (pattern.week === LAST_WEEK) {
      const last = lastOfMonth(first);
      return [last - mod(dayOfWeek(last) - pattern.dayOfWeek, 7)];
    }
    const daysAhead = mod(pattern.dayOfWeek - dayOfWeek(first), 7);
    return [first + daysAhead + (pattern.week - 1) * 7];
  }
  return [];
};

/** The first expected release day after [date]. */
export const nextAfter = (pattern: ReleasePattern, date: Day): Day => {
  switch (pattern.kind) {
    case 'everyDays':
      return (
        date + (pattern.days - mod(date - pattern.onSchedule, pattern.days))
      );
    case 'weekdays':
      for (let d = date + 1, i = 0; i < 7; d++, i++) {
        if (pattern.days.includes(dayOfWeek(d))) return d;
      }
      return date + 7;
    case 'batches': {
      const offset = mod(date - pattern.onSchedule, pattern.every);
      return date + (offset + 1 < pattern.length ? 1 : pattern.every - offset);
    }
    default: {
      let first = firstOfMonth(date);
      for (let i = 0; i < MAX_STEPS; i++, first = plusMonths(first, 1)) {
        const next = monthlyDaysIn(pattern, first)
          .sort((a, b) => a - b)
          .find(d => d > date);
        if (next !== undefined) return next;
      }
      return date + MAX_INTERVAL;
    }
  }
};

/** The last expected release day before [date]. */
export const previousBefore = (pattern: ReleasePattern, date: Day): Day => {
  switch (pattern.kind) {
    case 'everyDays':
      return date - (mod(date - pattern.onSchedule - 1, pattern.days) + 1);
    case 'weekdays':
      for (let d = date - 1, i = 0; i < 7; d--, i++) {
        if (pattern.days.includes(dayOfWeek(d))) return d;
      }
      return date - 7;
    case 'batches': {
      const dayBefore = date - 1;
      const offset = mod(dayBefore - pattern.onSchedule, pattern.every);
      return dayBefore - Math.max(offset - pattern.length + 1, 0);
    }
    default: {
      let first = firstOfMonth(date);
      for (let i = 0; i < MAX_STEPS; i++, first = plusMonths(first, -1)) {
        const previous = monthlyDaysIn(pattern, first)
          .sort((a, b) => b - a)
          .find(d => d < date);
        if (previous !== undefined) return previous;
      }
      return date - MAX_INTERVAL;
    }
  }
};

/** The expected release day closest to [date], which a release on [date] stands in for. */
export const nearest = (pattern: ReleasePattern, date: Day): Day => {
  // Release days are a day or two apart, so a release between them is more likely an extra than an early one
  if (pattern.kind === 'weekdays') return date;
  const before = previousBefore(pattern, date + 1);
  const after = nextAfter(pattern, date - 1);
  // A release halfway between is taken as late, so the next check comes sooner
  return date - before <= after - date ? before : after;
};

/** The most common key of [selector], if at least [COVERAGE] of the days share it. */
const mostCommon = <T>(days: Day[], selector: (day: Day) => T) => {
  const counts = new Map<T, number>();
  for (const day of days) {
    const key = selector(day);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: [T, number] | undefined;
  for (const entry of counts) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  return best && best[1] >= days.length * COVERAGE ? best[0] : undefined;
};

const weekdayOfMonth = (days: Day[]): ReleasePattern | null => {
  const weekday = mostCommon(days, dayOfWeek);
  if (weekday === undefined) return null;
  // A fifth week isn't in every month, so those days only count as the last week
  const week = mostCommon(days, d => Math.floor((ymd(d).day - 1) / 7) + 1);
  if (week !== undefined && week < 5) {
    return { kind: 'weekdayOfMonth', week, dayOfWeek: weekday };
  }
  const isLastWeek =
    days.filter(d => ymd(d).day + 7 > ymd(lastOfMonth(d)).day).length >=
    days.length * COVERAGE;
  return isLastWeek
    ? { kind: 'weekdayOfMonth', week: LAST_WEEK, dayOfWeek: weekday }
    : null;
};

const monthly = (days: Day[]): ReleasePattern | null => {
  const daysOfMonth = days.map(d => ymd(d).day);
  // Month-ends fall within the day tolerance too, but their median can be the 30th
  if (days.every(d => d === lastOfMonth(d))) {
    return { kind: 'daysOfMonth', days: [31] };
  }
  if (
    Math.max(...daysOfMonth) - Math.min(...daysOfMonth) <=
    DAY_OF_MONTH_TOLERANCE
  ) {
    return { kind: 'daysOfMonth', days: [median(daysOfMonth)] };
  }
  // The last day of the month moves between the 28th and the 31st
  if (daysOfMonth.every(d => d >= 28)) {
    return { kind: 'daysOfMonth', days: [31] };
  }
  return weekdayOfMonth(days);
};

const twiceMonthly = (days: Day[]): ReleasePattern | null => {
  const daysOfMonth = days.map(d => ymd(d).day).sort((a, b) => a - b);
  let split = 1;
  for (let i = 2; i < daysOfMonth.length; i++) {
    if (
      daysOfMonth[i] - daysOfMonth[i - 1] >
      daysOfMonth[split] - daysOfMonth[split - 1]
    ) {
      split = i;
    }
  }
  const halves = [daysOfMonth.slice(0, split), daysOfMonth.slice(split)];
  if (
    halves.some(
      half =>
        half.length < 2 ||
        half[half.length - 1] - half[0] > DAY_OF_MONTH_TOLERANCE,
    )
  ) {
    return null;
  }
  return { kind: 'daysOfMonth', days: [...new Set(halves.map(median))] };
};

const weekdays = (days: Day[], medianGap: number): ReleasePattern | null => {
  const counts = new Map<number, number>();
  for (const day of days) {
    counts.set(dayOfWeek(day), (counts.get(dayOfWeek(day)) ?? 0) + 1);
  }
  const byFrequency = [...counts].sort((a, b) => b[1] - a[1]);
  const selected: number[] = [];
  let covered = 0;
  for (const [weekday, count] of byFrequency) {
    if (covered >= days.length * COVERAGE) break;
    selected.push(weekday);
    covered += count;
  }
  // One weekday is a weekly interval, and an irregular schedule spreads over most of the week
  if (
    selected.length < 2 ||
    selected.length > MAX_WEEKDAYS ||
    covered < days.length * COVERAGE
  ) {
    return null;
  }
  // Releasing on several weekdays means more than one release a week
  if (medianGap > Math.floor(7 / selected.length) + 1) return null;
  return { kind: 'weekdays', days: selected.sort((a, b) => a - b) };
};

/** Runs of releases a day or two apart, starting at a steady interval and mostly longer than a day. */
const batches = (history: Day[]): ReleasePattern | null => {
  const runs: Day[][] = [];
  for (const day of history.slice(0, BATCH_HISTORY).reverse()) {
    const run = runs[runs.length - 1];
    if (run && day - run[run.length - 1] <= BATCH_GAP) run.push(day);
    else runs.push([day]);
  }
  const recent = runs.slice(-BATCHES);
  if (
    recent.length < MIN_BATCHES ||
    recent.filter(run => run.length > 1).length * 2 < recent.length
  ) {
    return null;
  }

  const gaps = recent.slice(1).map((run, i) => run[0] - recent[i][0]);
  const every = median(gaps);
  const length = median(recent.map(run => run[run.length - 1] - run[0] + 1));
  if (
    every < length * 2 ||
    gaps.some(gap => Math.abs(gap - every) > Math.floor(every / 4))
  ) {
    return null;
  }
  return {
    kind: 'batches',
    every,
    onSchedule: recent[recent.length - 1][0],
    length,
  };
};

/**
 * Finds a calendar pattern a plain day interval can't follow in [days], newest first: a few fixed weekdays,
 * days or a weekday of the month, or releases in batches, which can take longer than [days] to show up in
 * [history]. They all need a few releases to be told apart from chance.
 */
export const detectPattern = (
  days: Day[],
  history: Day[],
  medianGap: number,
): ReleasePattern | null => {
  if (days.length < PATTERN_MIN_RELEASES) return null;
  // Batches come first, since their days can look like a few weekdays or a monthly schedule
  const batched = batches(history);
  if (batched) return batched;
  if (medianGap >= 26 && medianGap <= 35) return monthly(days);
  if (medianGap >= 12 && medianGap <= 18) return twiceMonthly(days);
  return weekdays(days, medianGap);
};

export interface ReleaseSchedule {
  /** Days between releases, which is what the fetch interval shows. */
  interval: number;
  /** The most recent release day, which the next ones are counted from. */
  lastRelease: Day | null;
  pattern: ReleasePattern;
  /** Days past the expected day a release can still come, from how late recent ones were. */
  lateness: number;
  /** Whether checks spread out once releases stop coming, which a schedule set by the user doesn't. */
  backsOff: boolean;
  /** Lengths in days of earlier breaks in releases, which a break like a season's end is expected to last again. */
  pastBreaks: number[];
}

const cappedFrom = (day: Day, today: Day) =>
  Math.min(day, today + MAX_INTERVAL);

const firstFrom = (
  pattern: ReleasePattern,
  start: Day,
  accept: (day: Day) => boolean,
) => {
  let day = start;
  for (let i = 0; i < MAX_STEPS && !accept(day); i++) {
    day = nextAfter(pattern, day);
  }
  return day;
};

const backOff = (schedule: ReleaseSchedule, daysSinceRelease: number) => {
  let backedOff = schedule.interval;
  while (
    backedOff < MAX_INTERVAL &&
    daysSinceRelease > backedOff * HIATUS_CYCLES
  ) {
    backedOff *= 2;
  }
  return Math.min(backedOff, MAX_INTERVAL);
};

/** The next day to check for a release, as of [today]. Today counts, so a due release keeps being checked for. */
export const nextCheck = (schedule: ReleaseSchedule, today: Day): Day => {
  const { interval, pattern, lateness, pastBreaks } = schedule;
  const anchor = schedule.lastRelease ?? today;
  const daysSinceRelease = today - anchor;
  const isOnBreak =
    schedule.backsOff && daysSinceRelease > interval * HIATUS_CYCLES;
  // Around when earlier breaks ended, this one likely ends too, so the schedule is followed again
  if (
    isOnBreak &&
    !pastBreaks.some(
      b => daysSinceRelease >= b - interval && daysSinceRelease <= b + interval,
    )
  ) {
    // Past a few missed releases the schedule no longer holds, so checks spread out until it resumes
    const backedOff = backOff(schedule, daysSinceRelease);
    const next = anchor + Math.ceil(daysSinceRelease / backedOff) * backedOff;
    const breakEnds = pastBreaks
      .map(b => anchor + b - interval)
      .filter(d => d > today);
    return Math.min(next, ...breakEnds);
  }

  const due = nextAfter(pattern, nearest(pattern, anchor));
  if (today >= due && today <= due + lateness) return today;
  return cappedFrom(
    firstFrom(pattern, due, d => d >= today),
    today,
  );
};

/**
 * The next day to check after a check [today] found a release.
 *
 * The release is dated by its newest chapter, since a check can turn up one that came out on an earlier day. It
 * stands in for the expected day nearest to it, so an early, late or extra release leaves the schedule in place.
 */
export const nextCheckAfterRelease = (
  schedule: ReleaseSchedule,
  today: Day,
): Day => {
  const { pattern } = schedule;
  const release =
    schedule.lastRelease === null
      ? today
      : Math.min(schedule.lastRelease, today);
  // What was found is out already, so checking again today would only find it again
  const next = nextAfter(pattern, nearest(pattern, release));
  return cappedFrom(
    firstFrom(pattern, next, d => d > today),
    today,
  );
};

/** A schedule the user set to every [interval] days, counted from [lastRelease]. */
export const fixedSchedule = (
  interval: number,
  lastRelease: Day,
): ReleaseSchedule => ({
  interval,
  lastRelease,
  pattern: { kind: 'everyDays', days: interval, onSchedule: lastRelease },
  lateness: 0,
  backsOff: false,
  pastBreaks: [],
});

export interface ChapterDates {
  releaseTime?: string | null;
  updatedTime?: string | null;
}

/**
 * The release in [days], newest first, that the others land closest to in step with [interval], so one early
 * or late release doesn't shift the schedule. Ties go to the newest, which follows a schedule that moved.
 */
const medianPhase = (days: Day[], interval: number) => {
  const offset = (from: Day, to: Day) => {
    const m = mod(to - from, interval);
    return Math.min(m, interval - m);
  };
  let phase = days[0];
  let best = Infinity;
  for (const candidate of days) {
    const total = days.reduce((sum, d) => sum + offset(candidate, d), 0);
    if (total < best) {
      best = total;
      phase = candidate;
    }
  }
  const onPhase = days.filter(d => offset(phase, d) === 0).length;
  return onPhase * 5 >= days.length * 3 ? phase : days[0];
};

const zipGaps = (days: Day[]) =>
  days.slice(1).map((older, i) => days[i] - older);

/** Estimates the schedule from the recent release days of [chapters], by release date or else fetch date. */
export const estimateSchedule = (
  chapters: ChapterDates[],
  today: Day,
): ReleaseSchedule => {
  const recentReleases =
    chapters.length <= FEW_CHAPTERS ? FEW_CHAPTERS_RELEASES : RECENT_RELEASES;
  // Sources that date chapters ahead of their release would otherwise pull the schedule into the future
  const latestPlausibleDay = today + 1;
  const releaseDays = (values: (string | null | undefined)[]) =>
    [
      ...new Set(
        values
          .map(parseStoredDay)
          .filter((d): d is Day => d !== undefined && d <= latestPlausibleDay),
      ),
    ].sort((a, b) => b - a);

  const uploadDays = releaseDays(chapters.map(c => c.releaseTime));
  const fetchDays = releaseDays(chapters.map(c => c.updatedTime));
  const history =
    uploadDays.length >= MIN_RELEASES
      ? uploadDays
      : fetchDays.length >= MIN_RELEASES
      ? fetchDays
      : undefined;
  if (!history) {
    const lastRelease = uploadDays[0] ?? fetchDays[0] ?? null;
    return {
      interval: DEFAULT_INTERVAL,
      lastRelease,
      pattern: {
        kind: 'everyDays',
        days: DEFAULT_INTERVAL,
        onSchedule: lastRelease ?? today,
      },
      lateness: 0,
      backsOff: true,
      pastBreaks: [],
    };
  }
  const days = history.slice(0, recentReleases);

  const gaps = zipGaps(days).sort((a, b) => a - b);
  const medianGap = gaps[Math.floor((gaps.length - 1) / 2)];
  const detected = detectPattern(days, history, medianGap);
  // Within a batch releases are a day apart, but it's the batches that come every so often
  const interval = clamp(
    detected?.kind === 'batches' ? detected.every : medianGap,
    1,
    MAX_INTERVAL,
  );
  return {
    interval,
    lastRelease: days[0],
    pattern: detected ?? {
      kind: 'everyDays',
      days: interval,
      onSchedule: medianPhase(days.slice(0, PHASE_RELEASES), interval),
    },
    lateness: clamp(
      gaps[gaps.length - 1] - interval,
      0,
      Math.floor(interval / 2),
    ),
    backsOff: true,
    pastBreaks: zipGaps(history).filter(gap => gap > interval * HIATUS_CYCLES),
  };
};

export interface NovelScheduleState {
  /** 0 = not computed, > 0 = estimated days, < 0 = days set by the user. */
  fetchInterval: number;
  /** Start of the local day to check next, as an ISO timestamp. */
  nextUpdate: string | null;
  /** When an update last found chapters (Novel.lastUpdatedAt). */
  lastUpdatedAt?: string | null;
}

/**
 * Works out a novel's fetch interval and the next day to check it for new chapters.
 *
 * @param foundRelease whether the check that led here found new chapters.
 */
export const computeNovelSchedule = (
  novel: NovelScheduleState,
  chapters: ChapterDates[],
  today: Day,
  foundRelease = false,
): { fetchInterval: number; nextUpdate: Day; schedule: ReleaseSchedule } => {
  let schedule: ReleaseSchedule;
  if (novel.fetchInterval < 0) {
    // The check that found a release is the novel's last update
    const lastUpdate = foundRelease
      ? today
      : parseStoredDay(novel.lastUpdatedAt);
    schedule = fixedSchedule(-novel.fetchInterval, lastUpdate ?? today);
  } else {
    schedule = estimateSchedule(chapters, today);
  }

  const expectedDay = parseStoredDay(novel.nextUpdate);
  // A release on or after the expected day means the next one is counted from it instead
  const isAwaitingRelease =
    expectedDay !== undefined &&
    expectedDay >= today - 1 &&
    expectedDay <= today + 1 &&
    (schedule.lastRelease === null || schedule.lastRelease < expectedDay);

  let nextUpdate: Day;
  if (foundRelease) {
    nextUpdate = nextCheckAfterRelease(schedule, today);
  } else if (isAwaitingRelease) {
    nextUpdate = expectedDay;
  } else {
    nextUpdate = nextCheck(schedule, today);
  }

  return {
    fetchInterval:
      novel.fetchInterval < 0 ? novel.fetchInterval : schedule.interval,
    nextUpdate,
    schedule,
  };
};

/**
 * Whether a stored schedule should be worked out again after a fetch that found nothing new. A date still in
 * the ±1 day window is kept, so a late release keeps being checked for.
 */
export const shouldRecomputeSchedule = (
  novel: Pick<NovelScheduleState, 'fetchInterval' | 'nextUpdate'>,
  today: Day,
  { foundRelease, manual }: { foundRelease: boolean; manual: boolean },
) => {
  if (foundRelease || manual || novel.fetchInterval === 0) return true;
  const expectedDay = parseStoredDay(novel.nextUpdate);
  return expectedDay === undefined || expectedDay < today - 1;
};

/** Whether a library update should check a novel today: not predicted, or due by tomorrow. */
export const isDueForUpdate = (
  nextUpdate: string | null | undefined,
  today: Day,
) => {
  const expectedDay = parseStoredDay(nextUpdate);
  return expectedDay === undefined || expectedDay <= today + 1;
};

/** Days until the predicted next update, or null when there is no prediction to show. */
export const daysUntilNextUpdate = (
  novel: { nextUpdate?: string | null; status?: string | null },
  today: Day,
) => {
  if (novel.status === 'Completed') return null;
  const expectedDay = parseStoredDay(novel.nextUpdate);
  return expectedDay === undefined ? null : Math.max(expectedDay - today, 0);
};
