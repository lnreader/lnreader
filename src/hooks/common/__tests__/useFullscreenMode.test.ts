import { act, renderHook } from '@testing-library/react-native';
import { StatusBar } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';

import useFullscreenMode from '../useFullscreenMode';

const mockListeners: Record<string, () => void> = {};
const mockGeneralSettings = { fullScreenMode: true };

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: (event: string, listener: () => void) => {
      mockListeners[event] = listener;
      return () => delete mockListeners[event];
    },
  }),
}));

jest.mock('../../persisted', () => ({
  useChapterGeneralSettings: () => mockGeneralSettings,
  useChapterReaderSettings: () => ({ theme: '#202020' }),
  useTheme: () => ({ isDark: true }),
}));

jest.mock('@theme/utils/setBarColor', () => ({
  setStatusBarStyle: jest.fn(),
  setNavigationBarStyle: jest.fn(),
}));

jest.mock('expo-navigation-bar', () => ({
  NavigationBar: { setHidden: jest.fn() },
}));

const setHidden = NavigationBar.setHidden as jest.Mock;
const lastHidden = () => setHidden.mock.calls.at(-1)?.[0];
const emit = (event: string) => act(() => mockListeners[event]?.());

describe('useFullscreenMode', () => {
  beforeEach(() => {
    jest.spyOn(StatusBar, 'setHidden').mockImplementation(() => {});
    setHidden.mockClear();
    mockGeneralSettings.fullScreenMode = true;
  });

  // A novel link pushes the linked novel over the reader without removing it.
  it('shows the bars while another screen covers the reader', () => {
    renderHook(() => useFullscreenMode({ current: true }));
    expect(lastHidden()).toBe(true);

    emit('blur');

    expect(lastHidden()).toBe(false);
  });

  it('hides the bars again when the reader returns to the front', () => {
    renderHook(() => useFullscreenMode({ current: true }));
    emit('blur');
    // A reader opened from the linked novel shows the bars when it unmounts.
    NavigationBar.setHidden(false);

    emit('focus');

    expect(lastHidden()).toBe(true);
  });

  it('keeps the bars shown on return while the reader controls are open', () => {
    renderHook(() => useFullscreenMode({ current: false }));
    emit('blur');
    setHidden.mockClear();

    emit('focus');

    expect(setHidden).not.toHaveBeenCalledWith(true);
    expect(lastHidden()).toBe(false);
  });
});
