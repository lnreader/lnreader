import { act, render, screen } from '@testing-library/react-native';

import AppUpdateChecker from '../AppUpdateChecker';
import { useAppUpdateChecker } from '../useAppUpdateChecker';

jest.mock('../useAppUpdateChecker', () => ({
  useAppUpdateChecker: jest.fn(),
}));

jest.mock('../AppUpdateDialog', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return function MockAppUpdateDialog({
    onDismiss,
    onIgnore,
  }: {
    onDismiss: () => void;
    onIgnore: () => void;
  }) {
    return React.createElement('View', {
      onDismiss,
      onIgnore,
      testID: 'app-update-dialog',
    });
  };
});

const mockIgnoreVersion = jest.fn();
const mockAppRelease = {
  tag_name: 'v9.0.0',
  body: 'Release notes',
  downloadUrl: 'https://example.com/lnreader.apk',
};

describe('AppUpdateChecker', () => {
  beforeEach(() => {
    jest.mocked(useAppUpdateChecker).mockReturnValue({
      ignoreVersion: mockIgnoreVersion,
      isNewVersion: true,
      latestRelease: mockAppRelease,
    });
  });

  it('renders nothing when no update is available', () => {
    jest.mocked(useAppUpdateChecker).mockReturnValue({
      ignoreVersion: mockIgnoreVersion,
      isNewVersion: false,
      latestRelease: undefined,
    });

    render(<AppUpdateChecker />);

    expect(screen.queryByTestId('app-update-dialog')).toBeNull();
  });

  it('dismisses the current release for the session', () => {
    render(<AppUpdateChecker />);

    act(() => screen.getByTestId('app-update-dialog').props.onDismiss());

    expect(screen.queryByTestId('app-update-dialog')).toBeNull();
    expect(mockIgnoreVersion).not.toHaveBeenCalled();
  });

  it('persists the release tag when ignored', () => {
    render(<AppUpdateChecker />);

    act(() => screen.getByTestId('app-update-dialog').props.onIgnore());

    expect(mockIgnoreVersion).toHaveBeenCalledWith(mockAppRelease.tag_name);
  });
});
