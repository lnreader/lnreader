import { useSyncExternalStore } from 'react';

import { backgroundTasks } from '@services/backgroundTasks/backgroundTasks';
import type { QueuedBackgroundTask } from '@services/backgroundTasks/contracts';

/**
 * Subscribes to a value derived from the background task queue. The component
 * re-renders only when that value changes, so `selector` must return a
 * primitive (or an otherwise referentially stable value) – a selector that
 * builds a new object or array on every call re-renders forever.
 */
export const useBackgroundTasks = <T>(
  selector: (tasks: QueuedBackgroundTask[]) => T,
): T =>
  useSyncExternalStore(backgroundTasks.subscribe, () =>
    selector(backgroundTasks.getSnapshot()),
  );

/**
 * The whole queue, re-rendering on every change including progress updates.
 * Prefer `useBackgroundTasks` unless the progress itself is being displayed.
 */
export const useBackgroundTaskQueue = () =>
  useSyncExternalStore(backgroundTasks.subscribe, backgroundTasks.getSnapshot);

export const useDownloadIndex = () =>
  useSyncExternalStore(
    backgroundTasks.subscribe,
    backgroundTasks.getDownloadIndex,
  );
