import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@test-utils';

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => mockTheme,
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
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
import { defaultTheme } from '@theme/md3/defaultTheme';
import { SyncSettingsSection } from '../SyncSettingsSection';
import { SyncStatus } from '@services/sync/types';
import type { ThemeColors } from '@theme/types';

const mockTheme: ThemeColors = { id: 1, ...defaultTheme.light };

const mockShowToast = jest.fn();
jest.mock('@utils/showToast', () => ({
  showToast: (...args: any[]) => mockShowToast(...args),
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

const mockHasPreviousSignIn = jest.fn();
const mockGetTokens = jest.fn();
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    hasPreviousSignIn: () => mockHasPreviousSignIn(),
    getTokens: () => mockGetTokens(),
  },
}));

const mockTriggerStartupPull = jest.fn();
const mockSyncNow = jest.fn();
const mockNotifySyncDirty = jest.fn();
const mockGetStatus = jest.fn(() => SyncStatus.IDLE);
const mockAddSyncStatusListener = jest.fn(
  (_cb?: (status: SyncStatus) => void) => () => {},
);

jest.mock('@services/sync/driveSyncManager', () => ({
  driveSyncManager: {
    getStatus: () => mockGetStatus(),
    addSyncStatusListener: (cb: any) => mockAddSyncStatusListener(cb),
    notifySyncDirty: () => mockNotifySyncDirty(),
    triggerStartupPull: () => mockTriggerStartupPull(),
    syncNow: () => mockSyncNow(),
  },
}));

let mockAppSettings = {
  driveSyncEnabled: false,
  driveSyncWifiOnly: true,
  driveSyncLastTime: undefined as number | undefined,
};
const mockSetAppSettings = jest.fn((newSettings: any) => {
  mockAppSettings = { ...mockAppSettings, ...newSettings };
});

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockTheme,
  useAppSettings: () => ({
    ...mockAppSettings,
    setAppSettings: mockSetAppSettings,
  }),
}));

describe('SyncSettingsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAppSettings = {
      driveSyncEnabled: false,
      driveSyncWifiOnly: true,
      driveSyncLastTime: undefined,
    };
    mockHasPreviousSignIn.mockResolvedValue(true);
    mockGetTokens.mockResolvedValue({ accessToken: 'valid-token' });
  });

  it('renders disabled state initially', () => {
    const openGoogleDriveModal = jest.fn();
    render(
      <SyncSettingsSection
        theme={mockTheme}
        openGoogleDriveModal={openGoogleDriveModal}
      />,
    );

    expect(screen.getByText('backupScreen.sync.title')).toBeTruthy();
    expect(screen.getByText('backupScreen.sync.enableSync')).toBeTruthy();
    expect(screen.queryByText('backupScreen.sync.syncNow')).toBeNull();
  });

  it('prompts sign in modal if user toggles sync without google account', async () => {
    mockHasPreviousSignIn.mockResolvedValue(false);
    const openGoogleDriveModal = jest.fn();

    render(
      <SyncSettingsSection
        theme={mockTheme}
        openGoogleDriveModal={openGoogleDriveModal}
      />,
    );

    const toggle = screen.getByText('backupScreen.sync.enableSync');
    fireEvent.press(toggle);

    await waitFor(() => {
      expect(openGoogleDriveModal).toHaveBeenCalledTimes(1);
    });
    expect(mockSetAppSettings).not.toHaveBeenCalled();
  });

  it('enables sync and triggers startup pull when user is signed in', async () => {
    const openGoogleDriveModal = jest.fn();

    render(
      <SyncSettingsSection
        theme={mockTheme}
        openGoogleDriveModal={openGoogleDriveModal}
      />,
    );

    const toggle = screen.getByText('backupScreen.sync.enableSync');
    fireEvent.press(toggle);

    await waitFor(() => {
      expect(mockSetAppSettings).toHaveBeenCalledWith({
        driveSyncEnabled: true,
      });
    });
    expect(openGoogleDriveModal).not.toHaveBeenCalled();
    expect(mockNotifySyncDirty).toHaveBeenCalledTimes(1);
    expect(mockTriggerStartupPull).toHaveBeenCalledTimes(1);
  });

  it('calls syncNow when Sync Now button is pressed in enabled state', async () => {
    mockAppSettings.driveSyncEnabled = true;
    const openGoogleDriveModal = jest.fn();

    render(
      <SyncSettingsSection
        theme={mockTheme}
        openGoogleDriveModal={openGoogleDriveModal}
      />,
    );

    expect(screen.getByText('backupScreen.sync.syncNow')).toBeTruthy();
    const syncNowBtn = screen.getByText('backupScreen.sync.syncNow');
    fireEvent.press(syncNowBtn);

    await waitFor(() => {
      expect(mockSyncNow).toHaveBeenCalledTimes(1);
    });
  });

  it('prompts sign in modal and shows auth toast when syncNow fails with auth required message', async () => {
    mockAppSettings.driveSyncEnabled = true;
    mockSyncNow.mockRejectedValue(
      new Error('Google Drive sign-in is required.'),
    );
    const openGoogleDriveModal = jest.fn();

    render(
      <SyncSettingsSection
        theme={mockTheme}
        openGoogleDriveModal={openGoogleDriveModal}
      />,
    );

    const syncNowBtn = screen.getByText('backupScreen.sync.syncNow');
    fireEvent.press(syncNowBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'backupScreen.sync.authRequired',
      );
      expect(openGoogleDriveModal).toHaveBeenCalledTimes(1);
    });
  });

  it('prompts sign in modal when driveSyncManager status is AUTH_REQUIRED', async () => {
    mockAppSettings.driveSyncEnabled = true;
    mockGetStatus.mockReturnValue(SyncStatus.AUTH_REQUIRED);
    mockSyncNow.mockRejectedValue(new Error('Connection error'));
    const openGoogleDriveModal = jest.fn();

    render(
      <SyncSettingsSection
        theme={mockTheme}
        openGoogleDriveModal={openGoogleDriveModal}
      />,
    );

    const syncNowBtn = screen.getByText('backupScreen.sync.syncNow');
    fireEvent.press(syncNowBtn);

    await waitFor(() => {
      expect(mockShowToast).toHaveBeenCalledWith(
        'backupScreen.sync.authRequired',
      );
      expect(openGoogleDriveModal).toHaveBeenCalledTimes(1);
    });
  });
});
