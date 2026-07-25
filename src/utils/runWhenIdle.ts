/**
 * Schedules `task` to run once the JS thread is idle, and after `timeout` at
 * the latest. Useful for bookkeeping and prefetching that should never compete
 * with work the user is waiting for.
 *
 * Returns a canceller so callers can drop the task when it becomes irrelevant
 * (e.g. the screen unmounted before it ever ran).
 *
 * `requestIdleCallback` replaces the deprecated `InteractionManager`; it is
 * unavailable in the test environment, where a macrotask is close enough.
 */
export const runWhenIdle = (task: () => void, timeout = 500): (() => void) => {
  if (typeof requestIdleCallback !== 'function') {
    const handle = setTimeout(task, 0);
    return () => clearTimeout(handle);
  }

  const handle = requestIdleCallback(task, { timeout });
  return () => cancelIdleCallback(handle);
};
