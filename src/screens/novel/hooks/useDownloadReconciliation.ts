import { useEffect, useRef } from 'react';

export const useDownloadReconciliation = (
  isNovelDownloading: boolean,
  reloadChapters: () => Promise<void>,
) => {
  const hadNovelDownloadsRef = useRef(false);

  useEffect(() => {
    if (isNovelDownloading) {
      hadNovelDownloadsRef.current = true;
      return;
    }

    if (hadNovelDownloadsRef.current) {
      hadNovelDownloadsRef.current = false;
      void reloadChapters();
    }
  }, [isNovelDownloading, reloadChapters]);
};
