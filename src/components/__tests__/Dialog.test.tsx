import './mocks';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { Dialog } from '../Dialog';
import ConfirmationDialog from '../ConfirmationDialog/ConfirmationDialog';

const mockUseTheme = jest.fn();

jest.mock('@hooks/persisted', () => ({
  useTheme: () => mockUseTheme(),
}));

describe('Dialog', () => {
  beforeEach(() => {
    mockUseTheme.mockReturnValue({
      error: '#ba1a1a',
      onSurface: '#1d1b20',
      onSurfaceVariant: '#49454f',
      outlineVariant: '#cac4d0',
      primary: '#6750a4',
      scrim: '#000000',
      surface: '#fffbfe',
      surfaceContainerHigh: '#ece6f0',
      surface2: '#f7f2fa',
    });
  });

  it('renders composed dialog sections', () => {
    render(
      <Dialog.Root visible onDismiss={() => {}}>
        <Dialog.Header testID="dialog-header">
          <Dialog.Title>Dialog title</Dialog.Title>
          <Dialog.Description>Dialog description</Dialog.Description>
        </Dialog.Header>
        <Dialog.Content>
          <></>
        </Dialog.Content>
        <Dialog.List testID="dialog-list">
          <></>
        </Dialog.List>
        <Dialog.ScrollArea testID="scroll-area">
          <></>
        </Dialog.ScrollArea>
        <Dialog.Actions testID="dialog-actions">
          <Dialog.Action onPress={() => {}}>Save</Dialog.Action>
        </Dialog.Actions>
      </Dialog.Root>,
    );

    expect(screen.getByRole('header', { name: 'Dialog title' })).toBeTruthy();
    expect(screen.getByText('Dialog description')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
    expect(
      screen.getByTestId('dialog', { includeHiddenElements: true }),
    ).toHaveStyle({
      backgroundColor: '#ece6f0',
      minWidth: 280,
    });
    expect(screen.getByTestId('dialog-header')).toHaveStyle({ gap: 16 });
    expect(screen.getByTestId('dialog-actions')).toHaveStyle({
      gap: 8,
      marginTop: 8,
    });
    expect(screen.getByTestId('dialog-list')).toHaveStyle({
      marginHorizontal: -24,
    });
    expect(screen.getByTestId('scroll-area-top-divider')).toHaveStyle({
      backgroundColor: '#cac4d0',
      height: 1,
    });
    expect(screen.getByTestId('scroll-area-bottom-divider')).toHaveStyle({
      backgroundColor: '#cac4d0',
      height: 1,
    });
  });

  it('lets backdrop presses pass through the full-screen viewport', () => {
    render(
      <Dialog.Root visible onDismiss={() => {}}>
        <Dialog.Title>Dialog title</Dialog.Title>
      </Dialog.Root>,
    );

    expect(screen.getByTestId('dialog-viewport').props.pointerEvents).toBe(
      'box-none',
    );
  });

  it('dismisses when the backdrop is pressed', () => {
    const onDismiss = jest.fn();

    render(
      <Dialog.Root visible onDismiss={onDismiss}>
        <Dialog.Title>Dialog title</Dialog.Title>
      </Dialog.Root>,
    );

    fireEvent.press(
      screen.getByTestId('dialog-backdrop', {
        includeHiddenElements: true,
      }),
    );

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('runs and dismisses a confirmation action', async () => {
    const onConfirm = jest.fn();
    const onDismiss = jest.fn();

    render(
      <ConfirmationDialog
        title="Delete item?"
        confirmLabel="Delete"
        visible
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(screen.getByText('Delete'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });

  it('waits for an async confirmation action before dismissing', async () => {
    let resolveConfirmation: () => void = () => {};
    const onConfirm = jest.fn(
      () =>
        new Promise<void>(resolve => {
          resolveConfirmation = resolve;
        }),
    );
    const onDismiss = jest.fn();

    render(
      <ConfirmationDialog
        title="Delete item?"
        confirmLabel="Delete"
        visible
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />,
    );

    fireEvent.press(screen.getByText('Delete'));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    resolveConfirmation();
    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
  });
});
