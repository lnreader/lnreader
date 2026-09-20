import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import ErrorBoundary from 'react-native-error-boundary';

import { List } from '@components';
import { SafeAreaView } from 'react-native-safe-area-context';

// NOTE: ErrorFallback is rendered by AppErrorBoundary which sits OUTSIDE
// ThemeProvider in App.tsx. Do NOT call useTheme() here — it will crash.
// Use hardcoded colours so the error screen always renders.
const FALLBACK_BG = '#121212';
const FALLBACK_SURFACE = '#1e1e1e';
const FALLBACK_ON_SURFACE = '#e0e0e0';
const FALLBACK_ON_SURFACE_VARIANT = '#a0a0a0';
const FALLBACK_PRIMARY = '#bb86fc';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <SafeAreaView style={[styles.mainCtn, { backgroundColor: FALLBACK_BG }]}>
      <StatusBar translucent={true} backgroundColor="transparent" />
      <View style={styles.errorInfoCtn}>
        <Text style={[styles.errorTitle, { color: FALLBACK_ON_SURFACE }]}>
          An Unexpected Error Ocurred
        </Text>
        <Text style={[styles.errorDesc, { color: FALLBACK_ON_SURFACE }]}>
          The application ran into an unexpected error. We suggest you
          screenshot this message and then share it in our support channel on
          Discord.
        </Text>
        <Text
          style={[
            styles.errorCtn,
            {
              backgroundColor: FALLBACK_SURFACE,
              color: FALLBACK_ON_SURFACE_VARIANT,
            },
          ]}
          numberOfLines={20}
        >
          {`${error.message}\n\n${error.stack}`}
        </Text>
      </View>
      <List.Divider theme={{ outline: FALLBACK_ON_SURFACE_VARIANT } as any} />
      <TouchableOpacity
        onPress={resetError}
        style={[styles.buttonCtn, { backgroundColor: FALLBACK_PRIMARY }]}
        activeOpacity={0.8}
      >
        <Text style={styles.buttonText}>Restart the application</Text>
      </TouchableOpacity>
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
  buttonCtn: {
    margin: 16,
    marginBottom: 32,
    borderRadius: 4,
    padding: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    color: '#000',
  },
  errorCtn: {
    borderRadius: 8,
    lineHeight: 20,
    marginVertical: 16,
    paddingHorizontal: 8,
    paddingVertical: 16,
  },
  errorDesc: {
    lineHeight: 20,
    marginVertical: 8,
  },
  errorInfoCtn: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  errorTitle: {
    fontSize: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  mainCtn: {
    flex: 1,
  },
});
