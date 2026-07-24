import { useCallback } from 'react';
import { NovelInfo } from '@database/types';
import { pickCustomNovelCover } from '@database/queries/NovelQueries';

export const useCustomNovelCover = (
  novel: NovelInfo | undefined,
  setNovel: (novel: NovelInfo | undefined) => void,
) =>
  useCallback(async () => {
    if (!novel) {
      return;
    }

    const cover = await pickCustomNovelCover(novel);
    if (cover) {
      setNovel({ ...novel, cover });
    }
  }, [novel, setNovel]);
