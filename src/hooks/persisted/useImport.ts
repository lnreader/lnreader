import { useLibraryActions } from '@components/Context/LibraryContext';
import {
  backgroundTasks,
  QueuedBackgroundTask,
} from '@services/backgroundTasks';
import { DocumentPickerResult } from 'expo-document-picker';
import { useCallback, useEffect, useRef } from 'react';
import { useBackgroundTasks } from './useBackgroundTasks';

const countImports = (tasks: QueuedBackgroundTask[]) =>
  tasks.filter(t => t.task.name === 'IMPORT_EPUB').length;

export default function useImport() {
  const { refetchLibrary } = useLibraryActions();
  const importCount = useBackgroundTasks(countImports);
  const previousImportCount = useRef(importCount);

  useEffect(() => {
    if (previousImportCount.current > importCount) {
      void refetchLibrary();
    }
    previousImportCount.current = importCount;
  }, [importCount, refetchLibrary]);

  const importNovel = useCallback((pickedNovel: DocumentPickerResult) => {
    if (pickedNovel.canceled) return;
    backgroundTasks.enqueue({
      name: 'IMPORT_EPUB',
      data: {
        files: pickedNovel.assets.map(asset => ({
          filename: asset.name,
          uri: asset.uri,
        })),
      },
    });
  }, []);
  const resumeImport = () => backgroundTasks.resumeAll();

  const pauseImport = () => backgroundTasks.pauseAll();

  const cancelImport = () => backgroundTasks.cancelByType('IMPORT_EPUB');

  return {
    importNovel,
    resumeImport,
    pauseImport,
    cancelImport,
  };
}
