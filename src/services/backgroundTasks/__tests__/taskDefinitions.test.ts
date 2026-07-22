import type { NativeBackgroundTaskRecord } from '@modules/native-background-tasks';
import type { BackgroundTask } from '../contracts';
import {
  allowsDuplicateTask,
  createBackgroundTaskMetadata,
  fromNativeTaskRecord,
  getBackgroundTaskTitle,
} from '../taskDefinitions';

jest.mock('@strings/translations', () => ({
  getString: (key: string) => key,
}));

describe('background task definitions', () => {
  it.each<BackgroundTask['name']>([
    'DOWNLOAD_CHAPTER',
    'IMPORT_EPUB',
    'MIGRATE_NOVEL',
  ])('allows duplicate %s tasks', name => {
    expect(allowsDuplicateTask({ name } as BackgroundTask)).toBe(true);
  });

  it('prevents duplicate singleton task types', () => {
    expect(
      allowsDuplicateTask({ name: 'UPDATE_LIBRARY' } as BackgroundTask),
    ).toBe(false);
  });

  it('derives user-facing download metadata', () => {
    const task: BackgroundTask = {
      name: 'DOWNLOAD_CHAPTER',
      data: {
        novelName: 'Example Novel',
        chapters: [{ chapterId: 42, chapterName: 'Chapter 7' }],
      },
    };

    expect(getBackgroundTaskTitle(task)).toBe(
      'notifications.DOWNLOAD_CHAPTER: Example Novel',
    );
    expect(createBackgroundTaskMetadata(task, false)).toEqual({
      name: 'notifications.DOWNLOAD_CHAPTER: Example Novel',
      isRunning: false,
      progress: undefined,
      progressText: 'Chapter 7',
    });
  });

  it('derives metadata for a multi-file EPUB import', () => {
    const task: BackgroundTask = {
      name: 'IMPORT_EPUB',
      data: {
        files: [
          { filename: 'First.epub', uri: 'file://first' },
          { filename: 'Second.epub', uri: 'file://second' },
        ],
      },
    };

    expect(getBackgroundTaskTitle(task)).toBe('notifications.IMPORT_EPUB (2)');
    expect(createBackgroundTaskMetadata(task, false).progressText).toBe(
      'First.epub',
    );
  });

  it('maps a native record into the reactive queue projection', () => {
    const task: BackgroundTask = { name: 'UPDATE_LIBRARY' };
    const record: NativeBackgroundTaskRecord = {
      id: 'task-1',
      type: task.name,
      payload: JSON.stringify(task),
      title: 'Update library',
      state: 'running',
      progress: 0.5,
      progressText: 'Example Novel',
      attempt: 1,
      createdAt: 1,
      updatedAt: 2,
    };

    expect(fromNativeTaskRecord(record)).toEqual({
      id: 'task-1',
      task,
      state: 'running',
      meta: {
        name: 'Update library',
        isRunning: true,
        progress: 0.5,
        progressText: 'Example Novel',
      },
    });
  });
});
