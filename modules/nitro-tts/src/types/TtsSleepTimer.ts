export type TtsSleepTimerMode = 'duration' | 'chapters';

/** One-shot timer configuration for the active TTS session. */
export interface TtsSleepTimerConfig {
  mode: TtsSleepTimerMode;
  /** Required for duration timers. */
  durationSeconds?: number;
  /** Required for chapter timers. The active chapter counts as the first. */
  chapterCount?: number;
}

/** Current native sleep-timer projection. */
export interface TtsSleepTimerState {
  active: boolean;
  expired: boolean;
  mode?: TtsSleepTimerMode;
  remainingSeconds?: number;
  remainingChapters?: number;
}
