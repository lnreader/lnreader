import { useEffect, useState } from 'react';

import { initializeInstalledPlugins } from '@plugins/pluginManager';
import { backgroundTasks } from '@services/backgroundTasks';

type AppServicesState = {
  ready: boolean;
  error?: Error;
};

let initializationPromise: Promise<void> | undefined;

const initializeAppServices = (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = initializeInstalledPlugins()
      .then(async () => {
        await backgroundTasks.refresh();
      })
      .catch(error => {
        initializationPromise = undefined;
        throw error;
      });
  }

  return initializationPromise;
};

export const useInitializeAppServices = (
  databaseReady: boolean,
): AppServicesState => {
  const [state, setState] = useState<AppServicesState>({ ready: false });

  useEffect(() => {
    if (!databaseReady) return;

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
  }, [databaseReady]);

  return state;
};
