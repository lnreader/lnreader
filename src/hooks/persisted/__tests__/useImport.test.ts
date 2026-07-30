import { renderHook, waitFor } from '@testing-library/react-native';

import useImport from '../useImport';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { QueuedBackgroundTask } from '@services/backgroundTasks';

let mockQueue: QueuedBackgroundTask[] = [];

jest.mock('react-native-mmkv', () => ({
  useMMKVObject: () => [mockQueue],
}));

jest.mock('@components/Context/LibraryContext', () => ({
  useLibraryContext: jest.fn(),
}));

jest.mock('@services/backgroundTasks', () => ({
  BACKGROUND_TASKS_STORE_KEY: 'tasks',
  backgroundTasks: {
    enqueue: jest.fn(),
    resumeAll: jest.fn(),
    pauseAll: jest.fn(),
    cancelByType: jest.fn(),
  },
}));

const mockUseLibraryContext = useLibraryContext as jest.MockedFunction<
  typeof useLibraryContext
>;

const importTask = (id: string, progress = 0): QueuedBackgroundTask => ({
  id,
  task: { name: 'IMPORT_EPUB', data: { files: [] } },
  state: 'running',
  meta: {
    name: 'Import',
    isRunning: true,
    progress,
    progressText: undefined,
  },
});

describe('useImport', () => {
  const refetchLibrary = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    mockQueue = [];
    refetchLibrary.mockClear();
    mockUseLibraryContext.mockReturnValue({
      refetchLibrary,
    } as unknown as ReturnType<typeof useLibraryContext>);
  });

  it('ignores import progress updates and refetches when an import finishes', async () => {
    mockQueue = [importTask('import-1')];
    const { rerender } = renderHook(useImport);

    mockQueue = [importTask('import-1', 0.5)];
    rerender({});
    expect(refetchLibrary).not.toHaveBeenCalled();

    mockQueue = [];
    rerender({});

    await waitFor(() => expect(refetchLibrary).toHaveBeenCalledTimes(1));
  });

  it('does not refetch when an import is enqueued', () => {
    const { rerender } = renderHook(useImport);

    mockQueue = [importTask('import-1')];
    rerender({});

    expect(refetchLibrary).not.toHaveBeenCalled();
  });
});
