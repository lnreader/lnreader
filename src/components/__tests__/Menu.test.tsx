import './mocks';
import { fireEvent, render, screen } from '@testing-library/react-native';

import Menu from '../Menu';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

describe('Menu', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      isDark: false,
      onSurface: '#1d1b20',
      rippleColor: '#1d1b201f',
      shadow: '#000000',
      surface: '#fffbfe',
      surface2: '#f7f2fa',
      surfaceContainerLow: '#f7f2fa',
    });
  });

  it('dismisses when the area outside the menu is pressed', () => {
    const onDismiss = jest.fn();

    render(
      <Menu anchor={<></>} onDismiss={onDismiss} visible>
        <Menu.Item onPress={() => {}} title="Open" />
      </Menu>,
    );

    fireEvent.press(
      screen.getByTestId('menu-backdrop', {
        includeHiddenElements: true,
      }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps menu item presses separate from backdrop dismissal', () => {
    const onDismiss = jest.fn();
    const onPress = jest.fn();

    render(
      <Menu anchor={<></>} onDismiss={onDismiss} visible>
        <Menu.Item onPress={onPress} title="Open" />
      </Menu>,
    );

    fireEvent.press(screen.getByRole('menuitem', { name: 'Open' }));

    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
