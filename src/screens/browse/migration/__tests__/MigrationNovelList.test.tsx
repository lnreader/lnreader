import { fireEvent, render, screen } from '@test-utils';

import { backgroundTasks } from '@services/backgroundTasks';
import { showToast } from '@utils/showToast';
import MigrationNovelList from '../MigrationNovelList';

jest.mock('@components/Context/LibraryContext');
jest.mock('@services/plugin/fetch');
jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({ isDark: false }),
}));
jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = jest.requireActual('react-native');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };
  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactModule.createElement(View, props, children),
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});
jest.mock('@services/backgroundTasks', () => ({
  backgroundTasks: { enqueue: jest.fn() },
}));
jest.mock('@utils/showToast', () => ({ showToast: jest.fn() }));
jest.mock('../../globalsearch/GlobalSearchNovelCover', () => ({
  __esModule: true,
  default: function MockCover({
    novel,
    onPress,
  }: {
    novel: { name: string };
    onPress: () => void;
  }) {
    const { Text } = require('react-native');
    return <Text onPress={onPress}>{novel.name}</Text>;
  },
}));
jest.mock('../MigrationReviewDialog', () => ({
  __esModule: true,
  default: function MockDialog({
    visible,
    onMigrate,
  }: {
    visible: boolean;
    onMigrate: () => void;
  }) {
    const { Text } = require('react-native');
    return visible ? <Text onPress={onMigrate}>migrate</Text> : null;
  },
}));

const mockEnqueue = backgroundTasks.enqueue as jest.Mock;

const fromNovel = { id: 1, name: 'Source', pluginId: 'from' };
const data = {
  id: 'to-plugin',
  name: 'Plugin',
  lang: 'en',
  loading: false,
  novels: [{ name: 'Result', path: '/result' }],
};

const mountList = (props: Partial<Record<string, unknown>> = {}) => {
  const handlers = {
    onMigrationQueued: jest.fn(),
    onMigrationAborted: jest.fn(),
    onMigrationEnqueued: jest.fn(),
    onMigrationBlocked: jest.fn(),
  };
  render(
    <MigrationNovelList
      data={data as never}
      fromNovel={fromNovel as never}
      theme={{} as never}
      library={[]}
      navigation={{ push: jest.fn() } as never}
      isMigrating={false}
      {...handlers}
      {...props}
    />,
  );
  return handlers;
};

const startMigration = () => {
  fireEvent.press(screen.getByText('Result'));
  fireEvent.press(screen.getByText('migrate'));
};

describe('MigrationNovelList', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks the migration queued and does not abort when the task is queued', async () => {
    mockEnqueue.mockResolvedValue(true);
    const handlers = mountList();

    startMigration();
    await Promise.resolve();

    const target = {
      fromNovelId: 1,
      pluginId: 'to-plugin',
      toNovelPath: '/result',
    };
    expect(handlers.onMigrationQueued).toHaveBeenCalledWith(target);
    expect(mockEnqueue).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'MIGRATE_NOVEL' }),
    );
    expect(handlers.onMigrationEnqueued).toHaveBeenCalledWith(target);
    expect(handlers.onMigrationAborted).not.toHaveBeenCalled();
  });

  it('aborts the same target when the task could not be queued', async () => {
    mockEnqueue.mockResolvedValue(false);
    const handlers = mountList();

    startMigration();
    await Promise.resolve();
    await Promise.resolve();

    expect(handlers.onMigrationAborted).toHaveBeenCalledWith(
      handlers.onMigrationQueued.mock.calls[0][0],
    );
    expect(handlers.onMigrationEnqueued).not.toHaveBeenCalled();
  });

  it('reports a blocked tap instead of opening the dialog while migrating', () => {
    const handlers = mountList({ isMigrating: true });

    fireEvent.press(screen.getByText('Result'));

    expect(handlers.onMigrationBlocked).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('migrate')).toBeNull();
    expect(showToast).not.toHaveBeenCalled();
  });
});
