import { fireEvent, render, screen } from '@testing-library/react-native';
import * as Linking from 'expo-linking';

import AppUpdateDialog from '../AppUpdateDialog';

jest.mock('@i18n/translations', () => ({
  getString: (key: string) =>
    ({
      'common.install': 'Install',
      'common.later': 'Later',
      'common.newUpdateAvailable': 'New update available',
      'common.skipVersion': 'Skip version',
    }[key] ?? key),
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    onSurface: '#1d1b20',
    onSurfaceVariant: '#49454f',
    outlineVariant: '#cac4d0',
    primary: '#6750a4',
    scrim: '#000000',
    surface: '#fffbfe',
    surfaceContainerHigh: '#ece6f0',
  }),
}));

jest.mock('expo-linking', () => ({
  openURL: jest.fn(),
}));

const release = {
  tag_name: 'v9.0.0',
  body: '## Changes\n- First\n- Second\n',
  downloadUrl: 'https://example.com/lnreader.apk',
};

describe('AppUpdateDialog', () => {
  it('preserves release-note spacing within a content-sized scroll area', () => {
    render(
      <AppUpdateDialog
        release={release}
        onDismiss={jest.fn()}
        onIgnore={jest.fn()}
      />,
    );

    expect(screen.getByText('## Changes\n- First\n- Second')).toBeTruthy();
    expect(screen.getByTestId('app-update-release-notes').props.style).toEqual({
      maxHeight: expect.any(Number),
    });
    expect(
      screen.getByTestId('app-update-release-notes').props
        .contentContainerStyle,
    ).toEqual({
      paddingHorizontal: 24,
      paddingVertical: 16,
    });
  });

  it('exposes dismiss, skip, and install actions', () => {
    const onDismiss = jest.fn();
    const onIgnore = jest.fn();

    render(
      <AppUpdateDialog
        release={release}
        onDismiss={onDismiss}
        onIgnore={onIgnore}
      />,
    );

    fireEvent.press(screen.getByText('Later'));
    fireEvent.press(screen.getByText('Skip version'));
    fireEvent.press(screen.getByText('Install'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onIgnore).toHaveBeenCalledTimes(1);
    expect(Linking.openURL).toHaveBeenCalledWith(release.downloadUrl);
  });
});
