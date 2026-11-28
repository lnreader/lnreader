import * as LocalAuthentication from 'expo-local-authentication';

import { getString } from '@i18n/translations';

let authenticating = false;

/**
 * Showing the device-credential (PIN/pattern) screen pauses the activity, so
 * the app briefly reports `background` → `active`. The app lock checks this to
 * avoid locking itself again because of its own prompt.
 */
export const isDeviceAuthInProgress = () => authenticating;

export const canUseDeviceAuth = async (): Promise<boolean> => {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
};

export type DeviceAuthResult = 'success' | 'cancelled' | 'unavailable';

const UNAVAILABLE_ERRORS = new Set([
  'not_enrolled',
  'not_available',
  'passcode_not_set',
]);

export const authenticateDevice = async (
  promptMessage = getString('appLock.unlockPrompt'),
): Promise<DeviceAuthResult> => {
  if (authenticating) {
    return 'cancelled';
  }
  authenticating = true;
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      disableDeviceFallback: false,
    });
    if (result.success) {
      return 'success';
    }
    return UNAVAILABLE_ERRORS.has(result.error) ? 'unavailable' : 'cancelled';
  } catch {
    return 'cancelled';
  } finally {
    authenticating = false;
  }
};
