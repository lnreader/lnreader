import React from 'react';

import { Dialog, RadioButton } from '@components';
import { ThemeColors } from '@theme/types';
import { useAppSettings } from '@hooks/persisted';
import { APP_LOCK_ON_LAUNCH_ONLY } from '@hooks/persisted/useSettings';
import { getString } from '@i18n/translations';

export const APP_LOCK_DELAY_MINUTES = [1, 2, 5, 10, 20, 30];

export const getAppLockDelayLabel = (delayMs: number) => {
  if (delayMs === APP_LOCK_ON_LAUNCH_ONLY) {
    return getString('generalSettingsScreen.appLockDelayOnLaunch');
  }
  if (delayMs <= 0) {
    return getString('generalSettingsScreen.appLockDelayImmediately');
  }
  return getString('generalSettingsScreen.appLockDelayAfter', {
    duration: getString('time.minutes', { count: delayMs / 60000 }),
  });
};

interface AppLockDelayModalProps {
  appLockDelayMs: number;
  visible: boolean;
  hideModal: () => void;
  theme: ThemeColors;
}

const AppLockDelayModal: React.FC<AppLockDelayModalProps> = ({
  appLockDelayMs,
  visible,
  hideModal,
  theme,
}) => {
  const { setAppSettings } = useAppSettings();
  const options = [
    0,
    ...APP_LOCK_DELAY_MINUTES.map(minutes => minutes * 60 * 1000),
    APP_LOCK_ON_LAUNCH_ONLY,
  ];

  return (
    <Dialog.Root visible={visible} onDismiss={hideModal}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('generalSettingsScreen.appLockDelay')}
        </Dialog.Title>
        <Dialog.Description>
          {getString('generalSettingsScreen.appLockDelayDesc')}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.List>
        {options.map(delayMs => (
          <RadioButton
            key={delayMs}
            status={appLockDelayMs === delayMs}
            label={getAppLockDelayLabel(delayMs)}
            onPress={() => setAppSettings({ appLockDelayMs: delayMs })}
            theme={theme}
          />
        ))}
      </Dialog.List>
    </Dialog.Root>
  );
};

export default AppLockDelayModal;
