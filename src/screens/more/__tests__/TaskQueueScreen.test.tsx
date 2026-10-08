import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { backgroundTasks } from '@services/backgroundTasks';
import TaskQueueScreen from '../TaskQueueScreen';

const mockTaskQueue = [
  {
    id: 'task-1',
    task: {
      name: 'DOWNLOAD_CHAPTER' as const,
      data: {
        novelName: 'First Novel',
        chapters: [{ chapterId: 1, chapterName: 'Chapter 1' }],
      },
    },
    state: 'running' as const,
    meta: {
      name: 'Download: First Novel',
      isRunning: true,
      progress: 0.5,
      progressText: 'Chapter 1',
    },
  },
  {
    id: 'task-2',
    task: {
      name: 'DOWNLOAD_CHAPTER' as const,
      data: {
        novelName: 'Second Novel',
        chapters: [{ chapterId: 2, chapterName: 'Chapter 2' }],
      },
    },
    state: 'queued' as const,
    meta: {
      name: 'Download: Second Novel',
      isRunning: false,
      progress: undefined,
      progressText: 'Chapter 2',
    },
  },
];

jest.mock('react-native-mmkv', () => ({
  useMMKVObject: () => [mockTaskQueue],
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({
    error: '#ba1a1a',
    onPrimary: '#ffffff',
    onSurface: '#1d1b20',
    onSurfaceVariant: '#49454f',
    primary: '#6750a4',
    surface: '#fffbfe',
    surface2: '#f3edf7',
  }),
}));

jest.mock('@services/backgroundTasks', () => ({
  BACKGROUND_TASKS_STORE_KEY: 'background-tasks',
  backgroundTasks: {
    cancel: jest.fn().mockResolvedValue(undefined),
    cancelAll: jest.fn(),
    isRunning: true,
    pauseAll: jest.fn(),
    resumeAll: jest.fn(),
  },
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string, values?: { task?: string }) => {
    if (key === 'common.cancel') return 'Cancel';
    if (key === 'taskQueue.cancelTaskAction') return 'Cancel task';
    if (key === 'taskQueue.cancelTaskTitle') return 'Cancel task?';
    if (key === 'taskQueue.cancelTaskConfirmation') {
      return `Are you sure you want to cancel ${values?.task}?`;
    }
    if (key === 'taskQueue.keepTaskAction') return 'Keep task';
    return key;
  },
}));

jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, right: 0 }),
}));

jest.mock('@components', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const PassThrough = ({ children }: { children: ReactNode }) =>
    ReactModule.createElement(View, null, children);
  const Menu = Object.assign(PassThrough, {
    Item: ({ onPress, title }: { onPress: () => void; title: string }) =>
      ReactModule.createElement(
        Pressable,
        { onPress },
        ReactModule.createElement(Text, null, title),
      ),
  });

  return {
    Appbar: PassThrough,
    AppText: ({ children }: { children: ReactNode }) =>
      ReactModule.createElement(Text, null, children),
    ComposeList: ({ data, renderItem }: any) =>
      ReactModule.createElement(
        View,
        null,
        ...data.map((item: any, index: number) =>
          ReactModule.createElement(
            ReactModule.Fragment,
            { key: item.id },
            renderItem(item, index),
          ),
        ),
      ),
    ConfirmationDialog: ({
      cancelLabel,
      confirmLabel,
      message,
      onConfirm,
      onDismiss,
      title,
      visible,
    }: any) =>
      visible
        ? ReactModule.createElement(
            View,
            null,
            ReactModule.createElement(Text, null, title),
            ReactModule.createElement(Text, null, message),
            ReactModule.createElement(
              Pressable,
              {
                accessibilityLabel: cancelLabel,
                accessibilityRole: 'button',
                onPress: onDismiss,
              },
              ReactModule.createElement(Text, null, cancelLabel),
            ),
            ReactModule.createElement(
              Pressable,
              {
                accessibilityLabel: confirmLabel,
                accessibilityRole: 'button',
                onPress: onConfirm,
              },
              ReactModule.createElement(Text, null, confirmLabel),
            ),
          )
        : null,
    EmptyView: () => null,
    Fab: ({ label, onPress }: { label: string; onPress: () => void }) =>
      ReactModule.createElement(
        Pressable,
        { onPress },
        ReactModule.createElement(Text, null, label),
      ),
    IconButtonV2: ({ accessibilityLabel, color, onPress }: any) =>
      ReactModule.createElement(
        Pressable,
        {
          accessibilityHint: color ?? 'default',
          accessibilityLabel,
          accessibilityRole: 'button',
          onPress,
        },
        ReactModule.createElement(Text, null, accessibilityLabel),
      ),
    Menu,
    ProgressIndicator: () => ReactModule.createElement(View),
    Screen: ({ topBar, list, floatingAction, overlays }: any) =>
      ReactModule.createElement(
        View,
        null,
        topBar,
        list,
        floatingAction,
        overlays,
      ),
  };
});

describe('TaskQueueScreen', () => {
  it('confirms before cancelling only the task selected by the user', () => {
    render(
      <TaskQueueScreen
        navigation={{ goBack: jest.fn() } as never}
        route={{} as never}
      />,
    );

    const cancelButton = screen.getByRole('button', {
      name: 'Cancel Download: Second Novel',
    });
    expect(cancelButton.props.accessibilityHint).toBe('default');

    fireEvent.press(cancelButton);

    expect(backgroundTasks.cancel).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        'Are you sure you want to cancel Download: Second Novel?',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep task' })).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Cancel task' }));

    expect(backgroundTasks.cancel).toHaveBeenCalledWith('task-2');
  });
});
