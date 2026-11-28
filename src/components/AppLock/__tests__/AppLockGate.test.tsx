import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, AppStateStatus, Text } from 'react-native';

import AppLockGate from '../AppLockGate';

const mockAuthenticateDevice = jest.fn();
let mockAuthInProgress = false;
const mockSetAppSettings = jest.fn();
let mockSettings: Record<string, unknown> = {};

jest.mock('@utils/deviceAuth', () => ({
  authenticateDevice: () => mockAuthenticateDevice(),
  isDeviceAuthInProgress: () => mockAuthInProgress,
}));

jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));

jest.mock('@hooks/persisted/useSettings', () => ({
  APP_LOCK_ON_LAUNCH_ONLY: -1,
  useAppSettings: () => ({
    ...mockSettings,
    setAppSettings: mockSetAppSettings,
  }),
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({ background: '#000', onBackground: '#fff' }),
}));

jest.mock('@components', () => {
  const { Pressable, Text: RNText } = require('react-native');
  return {
    Button: ({ title, onPress }: { title: string; onPress: () => void }) => (
      <Pressable onPress={onPress}>
        <RNText>{title}</RNText>
      </Pressable>
    ),
  };
});

let appStateHandler: (state: AppStateStatus) => void;

const flush = () => act(() => Promise.resolve());

const renderGate = async () => {
  render(
    <AppLockGate>
      <Text>Library</Text>
    </AppLockGate>,
  );
  await flush();
};

const leaveAppFor = async (ms: number) => {
  act(() => appStateHandler('background'));
  jest.advanceTimersByTime(ms);
  act(() => appStateHandler('active'));
  await flush();
};

describe('AppLockGate', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAuthInProgress = false;
    mockSettings = { appLockEnabled: true, appLockDelayMs: 60_000 };
    mockAuthenticateDevice.mockReset().mockResolvedValue('cancelled');
    mockSetAppSettings.mockReset();
    AppState.currentState = 'active';
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        appStateHandler = handler;
        return { remove: jest.fn() };
      });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not lock when the app lock is off', async () => {
    mockSettings = { appLockEnabled: false };
    await renderGate();

    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    expect(mockAuthenticateDevice).not.toHaveBeenCalled();
  });

  it('locks on launch and prompts for authentication', async () => {
    await renderGate();

    expect(screen.getByTestId('app-lock-screen')).toBeTruthy();
    expect(mockAuthenticateDevice).toHaveBeenCalledTimes(1);
  });

  it('unlocks after a successful retry from the lock screen', async () => {
    await renderGate();

    mockAuthenticateDevice.mockResolvedValueOnce('success');
    fireEvent.press(screen.getByText('Unlock'));
    await flush();

    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
  });

  it('turns the lock off when the device no longer has a screen lock', async () => {
    mockAuthenticateDevice.mockResolvedValueOnce('unavailable');
    await renderGate();

    expect(mockSetAppSettings).toHaveBeenCalledWith({ appLockEnabled: false });
    expect(screen.queryByTestId('app-lock-screen')).toBeNull();
  });

  describe('after unlocking', () => {
    beforeEach(() => {
      mockAuthenticateDevice.mockResolvedValueOnce('success');
    });

    it('stays unlocked when the app returns within the lock delay', async () => {
      await renderGate();
      await leaveAppFor(30_000);

      expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    });

    it('locks again once the app was away for the lock delay', async () => {
      await renderGate();
      await leaveAppFor(60_000);

      expect(screen.getByTestId('app-lock-screen')).toBeTruthy();
      expect(mockAuthenticateDevice).toHaveBeenCalledTimes(2);
    });

    it('only locks on launch when set to do so', async () => {
      mockSettings = { appLockEnabled: true, appLockDelayMs: -1 };
      await renderGate();
      await leaveAppFor(60 * 60_000);

      expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    });

    it('ignores leaving the app for its own credential prompt', async () => {
      mockSettings = { appLockEnabled: true, appLockDelayMs: 0 };
      await renderGate();

      mockAuthInProgress = true;
      act(() => appStateHandler('background'));
      mockAuthInProgress = false;
      act(() => appStateHandler('active'));
      await flush();

      expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    });
  });
});
