import { useLibraryContext } from '@components/Context/LibraryContext';
import {
  BACKGROUND_TASKS_STORE_KEY,
  backgroundTasks,
  QueuedBackgroundTask,
} from '@services/backgroundTasks';
import { DocumentPickerResult } from 'expo-document-picker';
import { useCallback, useEffect, useMemo } from 'react';
import { useMMKVObject } from 'react-native-mmkv';

export default function useImport() {
  const { refetchLibrary } = useLibraryContext();
  const [queue] = useMMKVObject<QueuedBackgroundTask[]>(
    BACKGROUND_TASKS_STORE_KEY,
  );
  const importQueue = useMemo(
    () => queue?.filter(t => t.task.name === 'IMPORT_EPUB') || [],
    [queue],
  );

  useEffect(() => {
    refetchLibrary();
  }, [importQueue, refetchLibrary]);

  const importNovel = useCallback((pickedNovel: DocumentPickerResult) => {
    if (pickedNovel.canceled) return;
    backgroundTasks.enqueue(
      pickedNovel.assets.map(asset => ({
        name: 'IMPORT_EPUB',
        data: {
          filename: asset.name,
          uri: asset.uri,
        },
      })),
    );
  }, []);
  const resumeImport = () => backgroundTasks.resumeAll();

  const pauseImport = () => backgroundTasks.pauseAll();

  const cancelImport = () => backgroundTasks.cancelByType('IMPORT_EPUB');

  return {
    importQueue,
    importNovel,
    resumeImport,
    pauseImport,
    cancelImport,
  };
}
