import * as LocalAuthentication from 'expo-local-authentication';

import { getString } from '@i18n/translations';

export type DeviceAuthResult = 'success' | 'cancelled' | 'unavailable';

let pendingAuth: Promise<DeviceAuthResult> | null = null;

/**
 * Showing the device-credential (PIN/pattern) screen pauses the activity, so
 * the app briefly reports `background` → `active`. The app lock uses this to
 * tell its own prompt apart from the user actually leaving the app.
 */
export const getPendingDeviceAuth = () => pendingAuth;

export const canUseDeviceAuth = async (): Promise<boolean> => {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  } catch {
    return false;
  }
};

const UNAVAILABLE_ERRORS = new Set([
  'not_enrolled',
  'not_available',
  'passcode_not_set',
]);

const runAuthentication = async (
  promptMessage: string,
): Promise<DeviceAuthResult> => {
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
  }
};

export const authenticateDevice = async (
  promptMessage = getString('appLock.unlockPrompt'),
): Promise<DeviceAuthResult> => {
  if (pendingAuth) {
    return 'cancelled';
  }
  const auth = runAuthentication(promptMessage);
  pendingAuth = auth;
  try {
    return await auth;
  } finally {
    pendingAuth = null;
  }
};
