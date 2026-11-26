import React, { useMemo, useState } from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import ErrorBoundary from 'react-native-error-boundary';
import * as Clipboard from 'expo-clipboard';
import DeviceInfo from 'react-native-device-info';
import { BUILD_TYPE, GIT_HASH } from '@env';
import { version } from '../../../package.json';
import { getString } from '@i18n/translations';
import { getErrorChainMessages } from '@utils/error';
import { showToast } from '@utils/showToast';
import { Button, List } from '@components';
import { useTheme } from '@hooks/persisted';
import { SafeAreaView } from 'react-native-safe-area-context';
import { restartApplication, shareCrashLogs } from '@services/crashLogs';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const theme = useTheme();
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

  const copyStackTrace = async () => {
    try {
      const message = chainMessages.join('\n\nCaused by: ');
      await Clipboard.setStringAsync(`${message}\n\n${error.stack}`);
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
    <SafeAreaView
      style={[styles.mainCtn, { backgroundColor: theme.background }]}
    >
      <View style={styles.errorInfoCtn}>
        <Text style={[styles.errorTitle, { color: theme.onSurface }]}>
          {fallbackGetString(
            'errorBoundary.title',
            'An Unexpected Error Occurred',
          )}
        </Text>
        <Text style={[styles.errorDesc, { color: theme.onSurface }]}>
          {fallbackGetString(
            'errorBoundary.description',
            'The application ran into an unexpected error. Please share the crash logs in our Discord support channel.',
          )}
        </Text>
        <Text
          style={[styles.versionDetails, { color: theme.onSurfaceVariant }]}
        >
          {versionDetails}
        </Text>
        <ScrollView
          style={[
            styles.errorCtn,
            {
              backgroundColor: theme.surfaceVariant,
            },
          ]}
          contentContainerStyle={styles.errorContent}
        >
          <Text style={[styles.errorText, { color: theme.onSurfaceVariant }]}>
            {`${chainMessages.join('\n\nCaused by: ')}\n\n${error.stack}`}
          </Text>
        </ScrollView>
      </View>
      <List.Divider theme={theme} />
      <View style={styles.actionsCtn}>
        <Button
          disabled={isSharing}
          loading={isSharing}
          onPress={handleShareCrashLogs}
          title={fallbackGetString(
            'errorBoundary.shareCrashLogs',
            'Share crash logs',
          )}
          mode="outlined"
        />
        <Button
          onPress={handleRestart}
          title={fallbackGetString(
            'errorBoundary.restart',
            'Restart the application',
          )}
          mode="contained"
        />
      </View>
    </SafeAreaView>
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

const styles = StyleSheet.create({
  actionsCtn: {
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  errorCtn: {
    flex: 1,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorContent: {
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  errorText: {
    lineHeight: 20,
  },
  errorDesc: {
    lineHeight: 20,
    marginTop: 8,
  },
  errorInfoCtn: {
    flex: 1,
    padding: 16,
    paddingTop: 32,
  },
  errorTitle: {
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  versionDetails: {
    lineHeight: 24,
    marginVertical: 16,
    textAlign: 'center',
  },
  mainCtn: {
    flex: 1,
  },
});
