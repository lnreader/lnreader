import { fireEvent, render, screen } from '@testing-library/react-native';

import { showToast } from '@utils/showToast';
import { isMigrationPersisted } from '@services/migrate/verifyMigration';
import MigrationNovels from '../MigrationNovels';

const mockTasks: unknown[] = [];
let mockEnqueueFails = false;
let mockEnqueueResolves = false;
let mockTarget: unknown;
const mockPlugins = [{ id: 'to-plugin', name: 'Plugin', lang: 'en' }];

jest.mock('@hooks/persisted', () => ({
  useFilteredInstalledPlugins: () => mockPlugins,
  useTheme: () => ({ isDark: false, onSurface: '#000' }),
}));
jest.mock('@hooks/persisted/useBackgroundTasks', () => ({
  useBackgroundTasks: (selector: (tasks: unknown[]) => unknown) =>
    selector(mockTasks),
}));
jest.mock('@screens/library/hooks/useLibrary', () => ({
  useLibraryNovels: () => ({ library: [] }),
}));
jest.mock('@plugins/pluginManager', () => ({
  getPlugin: () => ({ searchNovels: jest.fn().mockResolvedValue([]) }),
}));
jest.mock('@services/migrate/verifyMigration', () => ({
  isMigrationPersisted: jest.fn(),
}));
jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));
jest.mock('@components', () => ({
  Appbar: () => null,
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@components/EmptyView', () => () => null);
jest.mock(
  '../../loadingAnimation/GlobalSearchSkeletonLoading',
  () => () => null,
);
jest.mock('../MigrationNovelList', () => ({
  __esModule: true,
  default: function MockMigrationNovelList({
    onMigrationQueued,
    onMigrationAborted,
    onMigrationEnqueued,
    onMigrationBlocked,
    isMigrating,
  }: {
    onMigrationQueued: (target: unknown) => void;
    onMigrationAborted: (target: unknown) => void;
    onMigrationEnqueued: (target: unknown) => void;
    onMigrationBlocked: () => void;
    isMigrating: boolean;
  }) {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable
        testID="queue"
        onPress={() => {
          mockTarget = {
            fromNovelId: 1,
            pluginId: 'to-plugin',
            toNovelPath: '/to',
          };
          onMigrationQueued(mockTarget);
          if (mockEnqueueFails) {
            onMigrationAborted(mockTarget);
          } else if (mockEnqueueResolves) {
            onMigrationEnqueued(mockTarget);
          }
        }}
      >
        <Text
          testID="stale-abort"
          onPress={() =>
            onMigrationAborted({
              fromNovelId: 1,
              pluginId: 'to-plugin',
              toNovelPath: '/to',
            })
          }
        >
          stale
        </Text>
        <Text testID="enqueued" onPress={() => onMigrationEnqueued(mockTarget)}>
          enqueued
        </Text>
        <Text onPress={onMigrationBlocked}>
          {isMigrating ? 'migrating' : 'idle'}
        </Text>
      </Pressable>
    );
  },
}));

const mockIsMigrationPersisted = isMigrationPersisted as jest.Mock;

const migrationTask = {
  id: 'task',
  state: 'running',
  task: {
    name: 'MIGRATE_NOVEL',
    data: { fromNovel: { id: 1 }, pluginId: 'to-plugin', toNovelPath: '/to' },
  },
};

describe('MigrationNovels', () => {
  const navigation = {
    pop: jest.fn(),
    goBack: jest.fn(),
    push: jest.fn(),
    isFocused: jest.fn(() => true),
    addListener: jest.fn((_event: string, _cb: () => void) => jest.fn()),
  };
  const route = { params: { novel: { id: 1, name: 'Novel' } } };

  const renderScreen = () =>
    render(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );

  beforeEach(() => {
    jest.clearAllMocks();
    mockTasks.length = 0;
    mockEnqueueFails = false;
    mockEnqueueResolves = false;
    mockIsMigrationPersisted.mockReturnValue(false);
    navigation.isFocused.mockReturnValue(true);
  });

  // The mocked source list only renders once a plugin search result exists.
  const queueMigration = async () => {
    fireEvent.press(await screen.findByTestId('queue'));
  };

  it('closes the screen only after the task has finished and the migration is persisted', async () => {
    const view = renderScreen();
    await queueMigration();

    mockTasks.push(migrationTask);
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );
    fireEvent.press(screen.getByTestId('enqueued'));
    expect(navigation.pop).not.toHaveBeenCalled();

    mockIsMigrationPersisted.mockReturnValue(true);
    mockTasks.length = 0;
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );

    expect(mockIsMigrationPersisted).toHaveBeenCalledWith({
      fromNovelId: 1,
      pluginId: 'to-plugin',
      toNovelPath: '/to',
    });
    expect(navigation.pop).toHaveBeenCalledWith(2);
    expect(showToast).toHaveBeenCalledWith('Migration complete');
  });

  it('stays open and reports failure when the task ends without persisting', async () => {
    mockIsMigrationPersisted.mockReturnValue(false);
    const view = renderScreen();
    await queueMigration();

    mockTasks.push(migrationTask);
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );
    fireEvent.press(screen.getByTestId('enqueued'));
    mockTasks.length = 0;
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );

    expect(navigation.pop).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(
      'Migration did not complete. Your novel was left unchanged.',
    );
    expect(screen.getByText('idle')).toBeTruthy();
  });

  it('closes when the task finished before it was ever observed in the queue', async () => {
    mockIsMigrationPersisted.mockReturnValue(true);
    renderScreen();
    await queueMigration();

    expect(navigation.pop).toHaveBeenCalledWith(2);
    expect(showToast).toHaveBeenCalledWith('Migration complete');
  });

  it('stays migrating while the task has not appeared in the queue yet', async () => {
    renderScreen();
    await queueMigration();

    expect(showToast).not.toHaveBeenCalled();
    expect(navigation.pop).not.toHaveBeenCalled();
    expect(screen.getByText('migrating')).toBeTruthy();
  });

  it('does not pop the stack when another screen is on top', async () => {
    navigation.isFocused.mockReturnValue(false);
    const view = renderScreen();
    await queueMigration();

    mockTasks.push(migrationTask);
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );
    fireEvent.press(screen.getByTestId('enqueued'));
    mockIsMigrationPersisted.mockReturnValue(true);
    mockTasks.length = 0;
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );

    expect(showToast).toHaveBeenCalledWith('Migration complete');
    expect(navigation.pop).not.toHaveBeenCalled();

    const unsubscribe = navigation.addListener.mock.results[0].value;
    const onFocus = navigation.addListener.mock.calls[0][1];
    onFocus();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(navigation.pop).toHaveBeenCalledWith(2);
  });

  it('drops the pending focus listener when the screen unmounts', async () => {
    navigation.isFocused.mockReturnValue(false);
    const view = renderScreen();
    await queueMigration();
    mockTasks.push(migrationTask);
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );
    fireEvent.press(screen.getByTestId('enqueued'));
    mockIsMigrationPersisted.mockReturnValue(true);
    mockTasks.length = 0;
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );

    view.unmount();

    expect(navigation.addListener.mock.results[0].value).toHaveBeenCalledTimes(
      1,
    );
    expect(navigation.pop).not.toHaveBeenCalled();
  });

  it('ignores a queued migration of the same novel to a different destination', async () => {
    const view = renderScreen();
    await queueMigration();

    mockTasks.push({
      ...migrationTask,
      task: {
        ...migrationTask.task,
        data: {
          fromNovel: { id: 1 },
          pluginId: 'to-plugin',
          toNovelPath: '/other',
        },
      },
    });
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );
    mockTasks.length = 0;
    view.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );

    expect(showToast).not.toHaveBeenCalled();
    expect(navigation.pop).not.toHaveBeenCalled();
    expect(screen.getByText('migrating')).toBeTruthy();
  });

  it('tells the user a migration is running when a tap is blocked', async () => {
    renderScreen();
    await queueMigration();
    mockTasks.push(migrationTask);
    screen.rerender(
      <MigrationNovels
        navigation={navigation as never}
        route={route as never}
      />,
    );

    fireEvent.press(screen.getByText('migrating'));

    expect(showToast).toHaveBeenCalledWith(
      'A migration is already in progress',
    );
    expect(screen.getByText('migrating')).toBeTruthy();
  });

  it('keeps the lock when a tap is blocked before the task is observed', async () => {
    renderScreen();
    await queueMigration();

    fireEvent.press(screen.getByText('migrating'));

    expect(showToast).toHaveBeenCalledWith(
      'A migration is already in progress',
    );
    expect(screen.getByText('migrating')).toBeTruthy();
  });

  it('releases the lock when the task could not be queued', async () => {
    mockEnqueueFails = true;
    renderScreen();

    fireEvent.press(await screen.findByTestId('queue'));

    expect(screen.getByText('idle')).toBeTruthy();
    expect(navigation.pop).not.toHaveBeenCalled();
  });

  it('ignores a late abort of an earlier migration', async () => {
    renderScreen();
    await queueMigration();

    fireEvent.press(screen.getByTestId('stale-abort'));

    expect(screen.getByText('migrating')).toBeTruthy();
  });

  it('reports failure when a queued task vanished before any render saw it', async () => {
    mockEnqueueResolves = true;
    renderScreen();

    fireEvent.press(await screen.findByTestId('queue'));

    expect(showToast).toHaveBeenCalledWith(
      'Migration did not complete. Your novel was left unchanged.',
    );
    expect(screen.getByText('idle')).toBeTruthy();
    expect(navigation.pop).not.toHaveBeenCalled();
  });

  it('closes when a queued task vanished before any render saw it and persisted', async () => {
    mockEnqueueResolves = true;
    mockIsMigrationPersisted.mockReturnValue(true);
    renderScreen();

    fireEvent.press(await screen.findByTestId('queue'));

    expect(showToast).toHaveBeenCalledWith('Migration complete');
    expect(navigation.pop).toHaveBeenCalledWith(2);
  });

  it('stays locked for a migration of this novel queued before the screen was opened', async () => {
    mockTasks.push(migrationTask);
    renderScreen();

    expect(await screen.findByText('migrating')).toBeTruthy();
    expect(showToast).not.toHaveBeenCalled();
  });
});
