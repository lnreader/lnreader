const MAX_CAUSE_DEPTH = 5;

export function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : String(error);
}

/**
 * Flattens an error's `cause` chain into `[cause, cause-of-cause, ...]`.
 * Drizzle's `DrizzleQueryError` keeps the native SQLite message on `.cause`
 * (e.g. "FOREIGN KEY constraint failed"), which `message` alone hides — the
 * reported trace for a failed migration used to end at "params:".
 */
export function getErrorCauseChain(error: unknown): unknown[] {
  const chain: unknown[] = [];
  let current = error;
  while (
    chain.length < MAX_CAUSE_DEPTH &&
    current instanceof Error &&
    current.cause !== undefined &&
    current.cause !== null
  ) {
    chain.push(current.cause);
    current = current.cause;
  }
  return chain;
}

export function getErrorChainMessages(error: unknown): string[] {
  return [error, ...getErrorCauseChain(error)].map(getErrorMessage);
}
