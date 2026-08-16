import { ChapterOrderKey } from '@database/constants';
import { ChapterInfo, NovelInfo } from '@database/types';
import { NovelSettings } from '../types';

export interface CreateNovelStoreParams {
  pluginId: string;
  novelPath: string;
  novel?: NovelInfo;
  defaultChapterSort?: ChapterOrderKey;
  initialPageIndex?: number;
  initialNovelSettings: NovelSettings;
  initialLastRead?: ChapterInfo;
}

export const createNovelSlice = ({
  pluginId,
  novelPath,
  novel,
  initialPageIndex = 0,
  initialNovelSettings,
  initialLastRead,
}: CreateNovelStoreParams) => {
  return {
    loading: false,
    fetching: false,
    error: undefined,
    pluginId,
    novelPath,
    novel,
    pageIndex: initialPageIndex,
    pages: [],
    novelSettings: initialNovelSettings,
    lastRead: initialLastRead,
  };
};
