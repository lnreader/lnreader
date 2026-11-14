import type { TaskProgressUpdater } from '@services/backgroundTasks/contracts';

export type RestorePhase =
  | 'source'
  | 'extract'
  | 'manifest'
  | 'novels'
  | 'categories'
  | 'settings'
  | 'plugins'
  | 'selectedFiles'
  | 'finalize';

export type RestoreProgressReporter = (
  phase: RestorePhase,
  fraction: number,
  progressText: string,
  force?: boolean,
) => void;

const PROGRESS_UPDATE_INTERVAL_MS = 250;

const LOCAL_PHASE_WEIGHTS: Record<RestorePhase, number> = {
  source: 0.09,
  extract: 0.21,
  manifest: 0.002,
  novels: 0.68,
  categories: 0.004,
  settings: 0.002,
  plugins: 0.004,
  selectedFiles: 0.005,
  finalize: 0.003,
};

const PHASES = Object.keys(LOCAL_PHASE_WEIGHTS) as RestorePhase[];

export const createRestoreProgressReporter = (
  setMeta: TaskProgressUpdater | undefined,
  source: 'local' | 'remote',
): RestoreProgressReporter | undefined => {
  if (!setMeta) {
    return undefined;
  }

  const weights = { ...LOCAL_PHASE_WEIGHTS };
  if (source === 'remote') {
    weights.source = 0.3;
    weights.extract = 0;
  }

  const phaseStarts = {} as Record<RestorePhase, number>;
  let nextStart = 0;
  for (const phase of PHASES) {
    phaseStarts[phase] = nextStart;
    nextStart += weights[phase];
  }

  let highWaterMark = 0;
  let currentPhase: RestorePhase | undefined;
  let lastEmittedProgress: number | undefined;
  let lastEmittedText: string | undefined;
  let lastEmittedAt = Number.NEGATIVE_INFINITY;

  return (phase, fraction, progressText, force = false) => {
    const normalizedFraction = Number.isNaN(fraction)
      ? 0
      : Math.max(0, Math.min(1, fraction));
    const mappedProgress = Math.max(
      0,
      Math.min(
        phase === 'finalize' && normalizedFraction === 1
          ? 1
          : 1 - Number.EPSILON,
        phaseStarts[phase] + weights[phase] * normalizedFraction,
      ),
    );
    highWaterMark = Math.max(highWaterMark, mappedProgress);

    const phaseChanged = currentPhase !== phase;
    currentPhase = phase;

    if (
      lastEmittedProgress === highWaterMark &&
      lastEmittedText === progressText
    ) {
      return;
    }

    const now = Date.now();
    const completed = normalizedFraction === 1;
    if (
      !phaseChanged &&
      !force &&
      !completed &&
      now - lastEmittedAt < PROGRESS_UPDATE_INTERVAL_MS
    ) {
      return;
    }

    lastEmittedProgress = highWaterMark;
    lastEmittedText = progressText;
    lastEmittedAt = now;
    setMeta(meta => ({
      ...meta,
      progress: highWaterMark,
      progressText,
    }));
  };
};
