import { useEffect, useRef } from 'react';

export const useDownloadReconciliation = (
  isNovelDownloading: boolean,
  downloadProgressKey: string,
  reloadChapters: () => Promise<void>,
) => {
  const hadNovelDownloadsRef = useRef(false);
  const previousProgressKeyRef = useRef('');

  useEffect(() => {
    if (isNovelDownloading) {
      if (
        hadNovelDownloadsRef.current &&
        previousProgressKeyRef.current !== downloadProgressKey
      ) {
        void reloadChapters();
      }
      hadNovelDownloadsRef.current = true;
      previousProgressKeyRef.current = downloadProgressKey;
      return;
    }

    if (hadNovelDownloadsRef.current) {
      hadNovelDownloadsRef.current = false;
      previousProgressKeyRef.current = '';
      void reloadChapters();
    }
  }, [downloadProgressKey, isNovelDownloading, reloadChapters]);
};
