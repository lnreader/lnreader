import { getMMKVObject, setMMKVObject, MMKVStorage } from '@utils/mmkv/mmkv';
import { logger } from './logger';
import { CrashRecord } from './types';

const LAST_CRASH_KEY = 'LAST_CRASH';

type ErrorHandlerCallback = (error: any, isFatal?: boolean) => void;

declare const ErrorUtils: {
  getGlobalHandler: () => ErrorHandlerCallback;
  setGlobalHandler: (callback: ErrorHandlerCallback) => void;
};

export function persistCrash(error: unknown, isFatal: boolean) {
  const record: CrashRecord = {
    ts: new Date().toISOString(),
    isFatal,
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  };
  setMMKVObject(LAST_CRASH_KEY, record);
}

export function getLastCrash(): CrashRecord | undefined {
  return getMMKVObject<CrashRecord>(LAST_CRASH_KEY);
}

export function clearLastCrash() {
  MMKVStorage.remove(LAST_CRASH_KEY);
}

let installed = false;

/**
 * Installs a process-wide JS error handler so uncaught exceptions and
 * unhandled promise rejections are recorded before the app dies, instead of
 * vanishing silently. Chains to whatever handler RN already installed (the
 * redbox / native crash reporter) so default behaviour is unchanged.
 */
export function installGlobalErrorHandler() {
  if (installed) {
    return;
  }
  installed = true;

  const previousHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Uncaught', message, error);
      persistCrash(error, Boolean(isFatal));
    } catch {
      // Logging must never prevent the real handler from running.
    }
    previousHandler?.(error, isFatal);
  });

  if (!__DEV__) {
    try {
      require('promise/setimmediate/rejection-tracking').enable({
        allRejections: true,
        onUnhandled: (_id: number, error: unknown) => {
          const message =
            error instanceof Error ? error.message : String(error);
          logger.error('UnhandledRejection', message, error);
        },
      });
    } catch {
      // Rejection tracking is best-effort.
    }
  }
}
