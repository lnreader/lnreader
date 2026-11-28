import { ReactNode } from 'react';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { AppState, AppStateStatus, Text } from 'react-native';

import { render } from '@test-utils';
import AppLockGate from '../AppLockGate';

const mockAuthenticateDevice = jest.fn();
let mockPendingAuth: Promise<string> | null = null;
const mockSetAppSettings = jest.fn();
let mockSettings: Record<string, unknown> = {};

jest.mock('@utils/deviceAuth', () => ({
  authenticateDevice: () => mockAuthenticateDevice(),
  getPendingDeviceAuth: () => mockPendingAuth,
}));

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

let appStateHandlers: ((state: AppStateStatus) => void)[] = [];
const appStateHandler = (state: AppStateStatus) =>
  appStateHandlers.forEach(handler => handler(state));

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
    mockPendingAuth = null;
    appStateHandlers = [];
    mockSettings = { appLockEnabled: true, appLockDelayMs: 60_000 };
    mockAuthenticateDevice.mockReset().mockResolvedValue('cancelled');
    mockSetAppSettings.mockReset();
    AppState.currentState = 'active';
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, handler) => {
        appStateHandlers.push(handler);
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

    const leaveDuringPrompt = async (result: string, ms: number) => {
      mockPendingAuth = Promise.resolve(result);
      act(() => appStateHandler('background'));
      mockPendingAuth = null;
      jest.advanceTimersByTime(ms);
      act(() => appStateHandler('active'));
      await flush();
    };

    it('ignores leaving the app for a prompt that succeeds', async () => {
      mockSettings = { appLockEnabled: true, appLockDelayMs: 0 };
      await renderGate();
      await leaveDuringPrompt('success', 5_000);

      expect(screen.queryByTestId('app-lock-screen')).toBeNull();
    });

    it('locks when the app was left during a prompt that was cancelled', async () => {
      await renderGate();
      await leaveDuringPrompt('cancelled', 60_000);

      expect(screen.getByTestId('app-lock-screen')).toBeTruthy();
    });
  });
});
