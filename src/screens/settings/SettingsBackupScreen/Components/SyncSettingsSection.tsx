import React, { useEffect, useState } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { List } from '@components';
import { useAppSettings } from '@hooks/persisted';
import { ThemeColors } from '@theme/types';
import { getString } from '@i18n/translations';
import { showToast } from '@utils/showToast';
import SettingSwitch from '../../components/SettingSwitch';
import { driveSyncManager } from '@services/sync/driveSyncManager';
import { SyncStatus } from '@services/sync/types';
import dayjs from 'dayjs';

interface SyncSettingsSectionProps {
  theme: ThemeColors;
  openGoogleDriveModal: () => void;
}

export const SyncSettingsSection: React.FC<SyncSettingsSectionProps> = ({
  theme,
  openGoogleDriveModal,
}) => {
  const {
    driveSyncEnabled = false,
    driveSyncWifiOnly = true,
    driveSyncLastTime,
    setAppSettings,
  } = useAppSettings();

  const [status, setStatus] = useState<SyncStatus>(
    driveSyncManager.getStatus(),
  );

  useEffect(() => {
    return driveSyncManager.addSyncStatusListener(newStatus => {
      setStatus(newStatus);
    });
  }, []);

  const handleToggleSync = async () => {
    if (!driveSyncEnabled) {
      try {
        const hasSignIn = await GoogleSignin.hasPreviousSignIn();
        if (!hasSignIn) {
          openGoogleDriveModal();
          return;
        }
        const tokens = await GoogleSignin.getTokens();
        if (!tokens.accessToken) {
          openGoogleDriveModal();
          return;
        }
      } catch {
        openGoogleDriveModal();
        return;
      }

      setAppSettings({ driveSyncEnabled: true });
      void driveSyncManager.triggerStartupPull();
    } else {
      setAppSettings({ driveSyncEnabled: false });
    }
  };

  const handleToggleWifiOnly = () => {
    setAppSettings({ driveSyncWifiOnly: !driveSyncWifiOnly });
  };

  const handleSyncNow = async () => {
    if (!driveSyncEnabled) return;
    try {
      // Verify authentication before attempting sync
      const hasSignIn = await GoogleSignin.hasPreviousSignIn();
      if (!hasSignIn) {
        showToast(getString('backupScreen.sync.authRequired'));
        openGoogleDriveModal();
        return;
      }
      const tokens = await GoogleSignin.getTokens();
      if (!tokens.accessToken) {
        showToast(getString('backupScreen.sync.authRequired'));
        openGoogleDriveModal();
        return;
      }

      await driveSyncManager.syncNow();
      showToast(getString('backupScreen.sync.syncComplete'));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isAuthError =
        driveSyncManager.getStatus() === SyncStatus.AUTH_REQUIRED ||
        message.includes('Google Drive sign-in is required') ||
        message.includes('SIGN_IN_REQUIRED') ||
        message.includes('401') ||
        message.includes('403');

      if (isAuthError) {
        showToast(getString('backupScreen.sync.authRequired'));
        openGoogleDriveModal();
      } else {
        showToast(message);
      }
    }
  };

  const getStatusText = (): string | null => {
    if (status === SyncStatus.SYNCING) {
      return getString('backupScreen.sync.syncing');
    }
    if (status === SyncStatus.OFFLINE) {
      return getString('backupScreen.sync.syncOffline');
    }
    if (status === SyncStatus.ERROR) {
      return getString('backupScreen.sync.syncError');
    }
    if (driveSyncLastTime) {
      return getString('backupScreen.sync.lastSynced', {
        time: dayjs(driveSyncLastTime).fromNow(),
      });
    }
    return null;
  };

  const statusText = getStatusText();

  return (
    <>
      <List.SubHeader theme={theme}>
        {getString('backupScreen.sync.title')}
      </List.SubHeader>
      <SettingSwitch
        value={Boolean(driveSyncEnabled)}
        label={getString('backupScreen.sync.enableSync')}
        description={getString('backupScreen.sync.enableSyncSummary')}
        onPress={handleToggleSync}
        theme={theme}
      />
      {driveSyncEnabled ? (
        <>
          <SettingSwitch
            value={Boolean(driveSyncWifiOnly)}
            label={getString('backupScreen.sync.wifiOnly')}
            onPress={handleToggleWifiOnly}
            theme={theme}
          />
          <List.Item
            title={getString('backupScreen.sync.syncNow')}
            theme={theme}
            disabled={status === SyncStatus.SYNCING}
            onPress={handleSyncNow}
          />
          {status === SyncStatus.AUTH_REQUIRED ? (
            <List.Item
              title={getString('backupScreen.sync.authRequired')}
              theme={theme}
              icon="alert-circle-outline"
              onPress={openGoogleDriveModal}
            />
          ) : null}
          {statusText ? (
            <List.InfoItem title={statusText} theme={theme} />
          ) : null}
        </>
      ) : null}
    </>
  );
};
