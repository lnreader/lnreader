import React from 'react';

import { fireEvent, render, screen } from '@test-utils';
import type { TtsSleepTimerState } from '@modules/nitro-tts';
import TtsSleepTimerDialog from '../TtsSleepTimerDialog';

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

jest.mock('@hooks/persisted/useTheme', () => {
  const theme = {
    error: '#ba1a1a',
    onPrimaryContainer: '#21005d',
    onSurface: '#1d1b20',
    onSurfaceVariant: '#49454f',
    outlineVariant: '#cac4d0',
    primary: '#6750a4',
    primaryContainer: '#eaddff',
    scrim: '#000000',
    surface: '#fffbfe',
    surfaceContainerHigh: '#ece6f0',
    surfaceVariant: '#e7e0ec',
  };
  return {
    ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
    useTheme: () => theme,
  };
});

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    error: '#ba1a1a',
    onPrimaryContainer: '#21005d',
    onSurface: '#1d1b20',
    onSurfaceVariant: '#49454f',
    outlineVariant: '#cac4d0',
    primary: '#6750a4',
    primaryContainer: '#eaddff',
    scrim: '#000000',
    surface: '#fffbfe',
    surfaceContainerHigh: '#ece6f0',
    surfaceVariant: '#e7e0ec',
  }),
}));

const inactiveTimer: TtsSleepTimerState = {
  active: false,
  expired: false,
};

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

const renderDialog = (
  overrides: Partial<React.ComponentProps<typeof TtsSleepTimerDialog>> = {},
) => {
  const props: React.ComponentProps<typeof TtsSleepTimerDialog> = {
    autoPageAdvance: true,
    onCancel: jest.fn(),
    onDismiss: jest.fn(),
    onStart: jest.fn(),
    timer: inactiveTimer,
    visible: true,
    ...overrides,
  };
  return {
    ...render(<TtsSleepTimerDialog {...props} />, { wrapper: TestWrapper }),
    props,
  };
};

describe('TtsSleepTimerDialog', () => {
  it('starts and replaces a duration timer from user input', () => {
    const { props } = renderDialog({
      timer: {
        active: true,
        expired: false,
        mode: 'duration',
        remainingSeconds: 60,
      },
    });

    fireEvent.changeText(screen.getByDisplayValue('0'), '1');
    fireEvent.changeText(screen.getByDisplayValue('30'), '20');
    fireEvent.press(screen.getByText('Start timer'));

    expect(props.onStart).toHaveBeenCalledWith({
      mode: 'duration',
      durationSeconds: 4800,
    });
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('starts a chapter timer and explains the auto-advance requirement', () => {
    const { props } = renderDialog({
      autoPageAdvance: false,
    });

    fireEvent.press(screen.getByText('Chapters'));
    fireEvent.changeText(screen.getByDisplayValue('1'), '3');

    expect(
      screen.getByText(
        'Multiple chapters are read only when Auto Page Advance is enabled.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByText('Start timer'));
    expect(props.onStart).toHaveBeenCalledWith({
      mode: 'chapters',
      chapterCount: 3,
    });
  });

  it('keeps the dialog open for invalid values', () => {
    const { props } = renderDialog();

    fireEvent.changeText(screen.getByDisplayValue('30'), '0');
    fireEvent.press(screen.getByText('Start timer'));

    expect(
      screen.getByText(
        'Enter a duration between 1 minute and 23 hours 59 minutes.',
      ),
    ).toBeTruthy();
    expect(props.onStart).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('rejects an invalid chapter count', () => {
    const { props } = renderDialog();

    fireEvent.press(screen.getByText('Chapters'));
    fireEvent.changeText(screen.getByDisplayValue('1'), '1000');
    fireEvent.press(screen.getByText('Start timer'));

    expect(screen.getByText('Enter between 1 and 999 chapters.')).toBeTruthy();
    expect(props.onStart).not.toHaveBeenCalled();
    expect(props.onDismiss).not.toHaveBeenCalled();
  });

  it('cancels an active timer', () => {
    const { props } = renderDialog({
      timer: {
        active: true,
        expired: false,
        mode: 'chapters',
        remainingChapters: 2,
      },
    });

    fireEvent.press(screen.getByText('Cancel timer'));

    expect(props.onCancel).toHaveBeenCalledTimes(1);
    expect(props.onDismiss).toHaveBeenCalledTimes(1);
  });
});
