import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@test-utils';
import { ErrorFallback } from '../AppErrorBoundary';
import { version } from '../../../../package.json';

const mockShareCrashLogs = jest.fn();
const mockRestartApplication = jest.fn();

const mockTheme = {
  background: '#ffffff',
  onSurface: '#000000',
  onSurfaceVariant: '#333333',
  surfaceVariant: '#eeeeee',
  outlineVariant: '#cccccc',
  primary: '#0061a4',
};

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => mockTheme,
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
}));

jest.mock('react-native-device-info', () => ({
  __esModule: true,
  default: { getBuildNumber: () => '42' },
}));

jest.mock('@env', () => ({ BUILD_TYPE: 'Debug', GIT_HASH: 'abc123' }));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = jest.requireActual('react-native');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };
  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: ReactNode }) =>
      ReactModule.createElement(View, props, children),
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('@services/crashLogs', () => ({
  shareCrashLogs: (error: Error) => mockShareCrashLogs(error),
  restartApplication: (fallback: () => void) =>
    mockRestartApplication(fallback),
}));

describe('ErrorFallback', () => {
  beforeEach(() => {
    mockShareCrashLogs.mockResolvedValue(undefined);
    mockRestartApplication.mockResolvedValue(undefined);
  });

  it('shares a diagnostic report for the displayed error', async () => {
    const error = new Error('boom');
    render(<ErrorFallback error={error} resetError={jest.fn()} />);

    fireEvent.press(screen.getByText('Share crash logs'));

    await waitFor(() => expect(mockShareCrashLogs).toHaveBeenCalledWith(error));
  });

  it('shows version and build details on the error screen', () => {
    render(<ErrorFallback error={new Error('boom')} resetError={jest.fn()} />);

    expect(
      screen.getByText(`Version: ${version} (42) · Debug · abc123`),
    ).toBeTruthy();
  });

  it('uses the native restart flow', async () => {
    const resetError = jest.fn();
    render(<ErrorFallback error={new Error('boom')} resetError={resetError} />);

    fireEvent.press(screen.getByText('Restart the application'));

    await waitFor(() =>
      expect(mockRestartApplication).toHaveBeenCalledWith(resetError),
    );
  });
});
