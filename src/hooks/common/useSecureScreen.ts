import { useEffect } from 'react';
import {
  allowScreenCaptureAsync,
  preventScreenCaptureAsync,
} from 'expo-screen-capture';

import { useAppSettings } from '@hooks/persisted';

const SECURE_SCREEN_KEY = 'secureScreenSetting';

/** Sets FLAG_SECURE, which also blanks the app's preview in recent apps. */
export const useSecureScreen = () => {
  const { secureScreen = false } = useAppSettings();

  useEffect(() => {
    const apply = secureScreen
      ? preventScreenCaptureAsync
      : allowScreenCaptureAsync;
    apply(SECURE_SCREEN_KEY).catch(() => {});
  }, [secureScreen]);
};
