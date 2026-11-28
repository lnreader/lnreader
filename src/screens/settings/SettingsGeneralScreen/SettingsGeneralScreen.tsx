import { ScrollView, StyleSheet } from 'react-native';

import { useBoolean } from '@hooks';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { Appbar, List, SafeAreaView } from '@components';
import { getString } from '@i18n/translations';
import { SettingsStackParamList } from '@navigators/types';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import SettingSwitch from '../components/SettingSwitch';
import DownloadCooldownModal from './modals/DownloadCooldownModal';
import InactivityTimeoutModal from './modals/InactivityTimeoutModal';
import AppLockDelayModal, {
  getAppLockDelayLabel,
} from './modals/AppLockDelayModal';
import { authenticateDevice, canUseDeviceAuth } from '@utils/deviceAuth';
import { showToast } from '@utils/showToast';

type GeneralSettingsProps = NativeStackScreenProps<
  SettingsStackParamList,
  'GeneralSettings'
>;

const GeneralSettings = ({ navigation }: GeneralSettingsProps) => {
  const theme = useTheme();
  const {
    appLockDelayMs = 0,
    appLockEnabled = false,
    chapterDownloadCooldownMs,
    disableHapticFeedback,
    disableLoadingAnimations,
    reduceAppAnimations = false,
    inactivityTimeoutMs,
    secureScreen = false,
    setAppSettings,
    timeTrackingEnabled,
  } = useAppSettings();

  const downloadCooldownModal = useBoolean();
  const inactivityTimeoutModal = useBoolean();
  const appLockDelayModal = useBoolean();

  const toggleAppLock = async () => {
    if (!appLockEnabled && !(await canUseDeviceAuth())) {
      showToast(getString('generalSettingsScreen.appLockNoDeviceLock'));
      return;
    }
    const result = await authenticateDevice(
      getString(
        appLockEnabled
          ? 'generalSettingsScreen.appLockDisablePrompt'
          : 'generalSettingsScreen.appLockEnablePrompt',
      ),
    );
    if (result === 'success') {
      setAppSettings({ appLockEnabled: !appLockEnabled });
    } else if (result === 'unavailable') {
      if (appLockEnabled) {
        setAppSettings({ appLockEnabled: false });
      } else {
        showToast(getString('generalSettingsScreen.appLockNoDeviceLock'));
      }
    }
  };

  return (
    <SafeAreaView excludeTop>
      <Appbar
        mode="small"
        title={getString('generalSettings')}
        handleGoBack={navigation.goBack}
        theme={theme}
      />
      <ScrollView contentContainerStyle={styles.paddingBottom}>
        <List.Section>
          <List.SubHeader theme={theme}>
            {getString('generalSettingsScreen.timeTracking')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('generalSettingsScreen.enableTimeTracking')}
            value={timeTrackingEnabled}
            description={getString(
              'generalSettingsScreen.enableTimeTrackingDesc',
            )}
            onPress={() =>
              setAppSettings({ timeTrackingEnabled: !timeTrackingEnabled })
            }
            theme={theme}
          />
          <List.Item
            title={getString('generalSettingsScreen.inactivityTimeout')}
            description={
              inactivityTimeoutMs === undefined
                ? getString('generalSettingsScreen.inactivityTimeoutNever')
                : getString('time.minutes', {
                    count: inactivityTimeoutMs / 60000,
                  })
            }
            onPress={inactivityTimeoutModal.setTrue}
            theme={theme}
          />
          <List.SubHeader theme={theme}>
            {getString('generalSettingsScreen.security')}
          </List.SubHeader>
          <SettingSwitch
            label={getString('generalSettingsScreen.appLock')}
            description={getString('generalSettingsScreen.appLockDesc')}
            value={appLockEnabled}
            onPress={toggleAppLock}
            theme={theme}
          />
          {appLockEnabled ? (
            <List.Item
              title={getString('generalSettingsScreen.appLockDelay')}
              description={getAppLockDelayLabel(appLockDelayMs)}
              onPress={appLockDelayModal.setTrue}
              theme={theme}
            />
          ) : null}
          <SettingSwitch
            label={getString('generalSettingsScreen.secureScreen')}
            description={getString('generalSettingsScreen.secureScreenDesc')}
            value={secureScreen}
            onPress={() => setAppSettings({ secureScreen: !secureScreen })}
            theme={theme}
          />
          <List.SubHeader theme={theme}>
            {getString('generalSettings')}
          </List.SubHeader>
          <List.Item
            title={getString('generalSettingsScreen.chapterDownloadCooldown')}
            description={`${(
              (chapterDownloadCooldownMs ?? 1000) / 1000
            ).toString()}s`}
            onPress={downloadCooldownModal.setTrue}
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.disableHapticFeedback')}
            description={getString(
              'generalSettingsScreen.disableHapticFeedbackDescription',
            )}
            value={disableHapticFeedback}
            onPress={() =>
              setAppSettings({ disableHapticFeedback: !disableHapticFeedback })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.reduceAppAnimations')}
            description={getString(
              'generalSettingsScreen.reduceAppAnimationsDesc',
            )}
            value={reduceAppAnimations}
            onPress={() =>
              setAppSettings({ reduceAppAnimations: !reduceAppAnimations })
            }
            theme={theme}
          />
          <SettingSwitch
            label={getString('generalSettingsScreen.disableLoadingAnimations')}
            description={getString(
              'generalSettingsScreen.disableLoadingAnimationsDesc',
            )}
            value={disableLoadingAnimations}
            onPress={() =>
              setAppSettings({
                disableLoadingAnimations: !disableLoadingAnimations,
              })
            }
            theme={theme}
          />
        </List.Section>
      </ScrollView>
      <DownloadCooldownModal
        visible={downloadCooldownModal.value}
        hideModal={downloadCooldownModal.setFalse}
        theme={theme}
      />
      <InactivityTimeoutModal
        inactivityTimeoutMs={inactivityTimeoutMs}
        modalVisible={inactivityTimeoutModal.value}
        hideModal={inactivityTimeoutModal.setFalse}
        theme={theme}
      />
      <AppLockDelayModal
        appLockDelayMs={appLockDelayMs}
        visible={appLockDelayModal.value}
        hideModal={appLockDelayModal.setFalse}
        theme={theme}
      />
    </SafeAreaView>
  );
};

export default GeneralSettings;

const styles = StyleSheet.create({
  paddingBottom: {
    paddingBottom: 24,
  },
});
