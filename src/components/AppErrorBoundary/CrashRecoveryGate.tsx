import { PropsWithChildren, useEffect, useMemo, useState } from 'react';

import { getPendingCrash } from '@services/crashLogs';
import { hideSplashScreen } from '@utils/splashScreen';
import { ErrorFallback } from './AppErrorBoundary';

const CrashRecoveryGate = ({ children }: PropsWithChildren) => {
  const [pendingCrash, setPendingCrash] = useState<string | null>();

  useEffect(() => {
    getPendingCrash()
      .then(crash => {
        setPendingCrash(crash);
        if (crash) {
          hideSplashScreen();
        }
      })
      .catch(() => setPendingCrash(null));
  }, []);

  const crashError = useMemo(() => {
    if (!pendingCrash) return null;
    const error = new Error('LNReader stopped unexpectedly on its last run.');
    error.stack = pendingCrash;
    return error;
  }, [pendingCrash]);

  if (pendingCrash === undefined) return null;
  if (crashError) {
    return <ErrorFallback error={crashError} resetError={() => null} />;
  }
  return children;
};

export default CrashRecoveryGate;
