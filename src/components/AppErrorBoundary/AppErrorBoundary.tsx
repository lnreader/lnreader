import React, { useMemo, useState } from 'react';
import { Card, Column, Row, Text } from '@expo/ui/jetpack-compose';
import {
  fillMaxSize,
  fillMaxWidth,
  horizontalScroll,
  padding,
  verticalScroll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import ErrorBoundary from 'react-native-error-boundary';
import * as Clipboard from 'expo-clipboard';
import DeviceInfo from 'react-native-device-info';
import { BUILD_TYPE, GIT_HASH } from '@env';
import { version } from '../../../package.json';
import { getString } from '@i18n/translations';
import { getErrorChainMessages } from '@utils/error';
import { showToast } from '@utils/showToast';
import { useTheme } from '@hooks/persisted/useTheme';
import { restartApplication, shareCrashLogs } from '@services/crashLogs';
import ErrorIcon from '@expo/material-symbols/error.xml';
import RestartAltIcon from '@expo/material-symbols/restart_alt.xml';
import ShareIcon from '@expo/material-symbols/share.xml';
import Button from '../Button/Button';
import AppIcon from '../AppIcon/AppIcon';
import ProgressIndicator from '../ProgressIndicator/ProgressIndicator';
import AppText from '../AppText/AppText';
import Screen from '../Screen/Screen';
import { useScreenInsets } from '../Screen/insets';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const theme = useTheme();
  const { top, bottom } = useScreenInsets();
  const [isSharing, setIsSharing] = useState(false);

  const fallbackGetString = (
    key: Parameters<typeof getString>[0],
    fallback: string,
    options?: Parameters<typeof getString>[1],
  ) => {
    try {
      return getString(key, options);
    } catch {
      return fallback;
    }
  };

  const chainMessages = useMemo(() => getErrorChainMessages(error), [error]);
  const versionDetails = [
    `${fallbackGetString(
      'aboutScreen.version',
      'Version',
    )}: ${version} (${DeviceInfo.getBuildNumber()})`,
    BUILD_TYPE || 'Custom build',
    GIT_HASH,
  ]
    .filter(Boolean)
    .join(' · ');
  const details = `${chainMessages.join('\n\nCaused by: ')}\n\n${error.stack}`;

  const copyStackTrace = async () => {
    try {
      await Clipboard.setStringAsync(details);
      return true;
    } catch {
      return false;
    }
  };

  const handleShareCrashLogs = async () => {
    setIsSharing(true);
    try {
      await shareCrashLogs(error);
    } catch {
      const copiedStackTrace = await copyStackTrace();
      showToast(
        copiedStackTrace
          ? fallbackGetString(
              'errorBoundary.shareCrashLogsFailed',
              'Could not share crash logs. The stack trace was copied instead.',
            )
          : fallbackGetString(
              'errorBoundary.shareCrashLogsFailedWithoutCopy',
              'Could not share crash logs or copy the stack trace.',
            ),
      );
    } finally {
      setIsSharing(false);
    }
  };

  const handleRestart = () => {
    restartApplication(resetError).catch(resetError);
  };

  return (
    <Screen>
      <Column
        horizontalAlignment="center"
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxSize(),
          verticalScroll(),
          padding(24, top + 32, 24, bottom + 24),
        ]}
      >
        <AppIcon source={ErrorIcon} size={48} tint={theme.error} />
        <AppText variant="headlineSmall" align="center">
          {fallbackGetString(
            'errorBoundary.title',
            'An Unexpected Error Occurred',
          )}
        </AppText>
        <AppText
          variant="bodyMedium"
          align="center"
          color={theme.onSurfaceVariant}
        >
          {fallbackGetString(
            'errorBoundary.description',
            'The application ran into an unexpected error. Please share the crash logs in our Discord support channel.',
          )}
        </AppText>
        <AppText
          variant="bodyMedium"
          align="center"
          color={theme.onSurfaceVariant}
        >
          {versionDetails}
        </AppText>
        <Card
          colors={{
            containerColor: theme.surfaceContainerHigh,
            contentColor: theme.onSurfaceVariant,
          }}
          modifiers={[fillMaxWidth()]}
        >
          <Column
            modifiers={[
              fillMaxWidth(),
              horizontalScroll(),
              padding(16, 16, 16, 16),
            ]}
          >
            <Text
              style={{ fontFamily: 'monospace', fontSize: 12 }}
              maxLines={40}
            >
              {details}
            </Text>
          </Column>
        </Card>
        {isSharing ? <ProgressIndicator /> : null}
        <Row
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <Button
            mode="contained-tonal"
            icon={ShareIcon}
            disabled={isSharing}
            title={fallbackGetString(
              'errorBoundary.shareCrashLogs',
              'Share crash logs',
            )}
            onPress={() => void handleShareCrashLogs()}
            modifiers={[weight(1)]}
          />
          <Button
            mode="contained"
            icon={RestartAltIcon}
            title={fallbackGetString(
              'errorBoundary.restart',
              'Restart the application',
            )}
            onPress={handleRestart}
            modifiers={[weight(1)]}
          />
        </Row>
      </Column>
    </Screen>
  );
};

interface AppErrorBoundaryProps {
  children: React.ReactElement;
}

const AppErrorBoundary: React.FC<AppErrorBoundaryProps> = ({ children }) => {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>{children}</ErrorBoundary>
  );
};

export default AppErrorBoundary;
