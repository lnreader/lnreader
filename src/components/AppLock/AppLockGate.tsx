import {
  PropsWithChildren,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  BackHandler,
  Image,
  Modal,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button } from '@components';
import {
  APP_LOCK_ON_LAUNCH_ONLY,
  useAppSettings,
} from '@hooks/persisted/useSettings';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { authenticateDevice, isDeviceAuthInProgress } from '@utils/deviceAuth';
import { showToast } from '@utils/showToast';

export const shouldRelock = (
  backgroundedAt: number | null,
  now: number,
  delayMs: number,
) =>
  backgroundedAt !== null &&
  delayMs !== APP_LOCK_ON_LAUNCH_ONLY &&
  now - backgroundedAt >= delayMs;

const AppLockGate = ({ children }: PropsWithChildren) => {
  const theme = useTheme();
  const {
    appLockEnabled = false,
    appLockDelayMs = 0,
    setAppSettings,
  } = useAppSettings();
  const [lockedState, setLocked] = useState(appLockEnabled);
  const locked = appLockEnabled && lockedState;
  const backgroundedAt = useRef<number | null>(null);
  const lockedRef = useRef(locked);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  const unlock = useCallback(async () => {
    const result = await authenticateDevice();
    if (result === 'success') {
      setLocked(false);
    } else if (result === 'unavailable') {
      // The device lock was removed after the app lock was turned on; keeping
      // the app locked would lock the user out for good.
      setAppSettings({ appLockEnabled: false });
      setLocked(false);
      showToast(getString('appLock.disabledNoDeviceLock'));
    }
    // setAppSettings is recreated on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lockedRef.current && AppState.currentState === 'active') {
      unlock();
    }
  }, [unlock]);

  useEffect(() => {
    if (!appLockEnabled) {
      return;
    }
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'background') {
        if (backgroundedAt.current === null && !isDeviceAuthInProgress()) {
          backgroundedAt.current = Date.now();
        }
      } else if (state === 'active') {
        const leftAt = backgroundedAt.current;
        backgroundedAt.current = null;
        // Returning from the device-credential screen never recorded a
        // background time; re-prompting then would trap the user in a loop.
        if (leftAt === null) {
          return;
        }
        if (
          lockedRef.current ||
          shouldRelock(leftAt, Date.now(), appLockDelayMs)
        ) {
          setLocked(true);
          unlock();
        }
      }
    });
    return () => subscription.remove();
  }, [appLockEnabled, appLockDelayMs, unlock]);

  return (
    <>
      <View
        style={styles.flex}
        importantForAccessibility={locked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {locked ? (
        <View style={[styles.cover, { backgroundColor: theme.background }]} />
      ) : null}
      {/* A native modal, unlike an overlay view, also covers dialogs and
          sheets that were open when the app was left. */}
      <Modal
        visible={locked}
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={BackHandler.exitApp}
      >
        <View
          testID="app-lock-screen"
          style={[styles.lockScreen, { backgroundColor: theme.background }]}
        >
          <Image
            source={require('../../../assets/logo.png')}
            style={[styles.logo, { tintColor: theme.onBackground }]}
          />
          <Text style={[styles.title, { color: theme.onBackground }]}>
            {getString('appLock.locked')}
          </Text>
          <Button
            mode="contained"
            icon="lock-open-outline"
            onPress={unlock}
            title={getString('appLock.unlock')}
          />
        </View>
      </Modal>
    </>
  );
};

export default AppLockGate;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: StyleSheet.absoluteFill,
  lockScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  logo: {
    height: 96,
    marginBottom: 24,
    width: 96,
  },
  title: {
    fontSize: 20,
    marginBottom: 24,
    textAlign: 'center',
  },
});
