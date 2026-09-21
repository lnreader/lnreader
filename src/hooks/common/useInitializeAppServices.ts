import { useEffect, useState } from 'react';

import { initializeInstalledPlugins } from '@plugins/pluginManager';
import { backgroundTasks } from '@services/backgroundTasks';

type AppServicesState = {
  ready: boolean;
  error?: Error;
};

let initializationPromise: Promise<void> | undefined;

/**
 * Neither of these touches the database, so they run alongside the migration
 * instead of queueing up behind it – and alongside each other, rather than
 * paying for the plugin bundles and the native task table back to back.
 */
const initializeAppServices = (): Promise<void> => {
  if (!initializationPromise) {
    initializationPromise = Promise.all([
      initializeInstalledPlugins(),
      backgroundTasks.refresh(),
    ])
      .then(() => undefined)
      .catch(error => {
        initializationPromise = undefined;
        throw error;
      });
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
