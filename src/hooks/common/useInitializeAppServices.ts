import { useEffect, useState } from 'react';

import { initializeInstalledPlugins } from '@plugins/pluginManager';
import { backgroundTasks } from '@services/backgroundTasks';

type AppServicesState = {
  ready: boolean;
  error?: Error;
};

let initializationPromise: Promise<void> | undefined;

/**
 * Everything the first frame genuinely depends on, and nothing else.
 *
 * Plugin bundles are read from disk and from MMKV, so they do not need the
 * database and are loaded alongside it rather than after it. The background
 * task queue only mirrors the native records into MMKV, which every consumer
 * observes reactively, so it catches up on its own once it lands — awaiting it
 * here put a native WorkManager round trip (and the Room database it creates on
 * first launch) in front of the first frame for no benefit.
 */
const initializeAppServices = (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = initializeInstalledPlugins()
      .then(() => undefined)
      .catch(error => {
        initializationPromise = undefined;
        throw error;
      });

    backgroundTasks.refresh().catch(() => undefined);
  }

  return initializationPromise;
};

export const useInitializeAppServices = (): AppServicesState => {
  const [state, setState] = useState<AppServicesState>({ ready: false });

  useEffect(() => {
    let isActive = true;

    initializeAppServices()
      .then(() => {
        if (isActive) setState({ ready: true });
      })
      .catch(error => {
        if (!isActive) return;

        setState({
          ready: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      });

    return () => {
      isActive = false;
    };
  }, []);

  return state;
};
