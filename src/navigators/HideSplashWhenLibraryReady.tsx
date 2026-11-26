import { useEffect } from 'react';

import { useLibraryContext } from '@components/Context/LibraryContext';
import { hideSplashScreen } from '@utils/splashScreen';

/**
 * Keeps the splash up through the library's first load so launch goes
 * straight from the splash to the populated library instead of flashing the
 * loading skeleton.
 */
const HideSplashWhenLibraryReady = () => {
  const { isLoading } = useLibraryContext();

  useEffect(() => {
    if (!isLoading) {
      hideSplashScreen();
    }
  }, [isLoading]);

  return null;
};

export default HideSplashWhenLibraryReady;
