import { useEffect, useRef } from 'react';

export const useDownloadReconciliation = (
  isNovelDownloading: boolean,
  downloadProgressKey: string,
  reconcile: () => Promise<void>,
) => {
  const hadNovelDownloadsRef = useRef(false);
  const previousProgressKeyRef = useRef('');

  useEffect(() => {
    if (isNovelDownloading) {
      if (
        hadNovelDownloadsRef.current &&
        previousProgressKeyRef.current !== downloadProgressKey
      ) {
        void reconcile();
      }
      hadNovelDownloadsRef.current = true;
      previousProgressKeyRef.current = downloadProgressKey;
      return;
    }

    if (hadNovelDownloadsRef.current) {
      hadNovelDownloadsRef.current = false;
      previousProgressKeyRef.current = '';
      void reconcile();
    }
  }, [downloadProgressKey, isNovelDownloading, reconcile]);
};
