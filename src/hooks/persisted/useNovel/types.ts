import { ChapterFilterKey, ChapterOrderKey } from '@database/constants';

export const NOVEL_PAGE_INDEX_PREFIX = 'NOVEL_PAGE_INDEX_PREFIX';
export const NOVEL_SETTINGS_PREFIX = 'NOVEL_SETTINGS';
export const LAST_READ_PREFIX = 'LAST_READ_PREFIX';

export const defaultNovelSettings: NovelSettingsWithoutSort = {
  showChapterTitles: true,
  filter: [],
  autoTranslate: false,
  translationLang: '',
};

export const defaultPageIndex = 0;

export interface NovelSettingsWithoutSort {
  filter: ChapterFilterKey[];
  showChapterTitles: boolean;
  sort?: ChapterOrderKey;
  autoTranslate?: boolean;
  translationLang?: string;
}
export interface NovelSettings extends NovelSettingsWithoutSort {
  sort: ChapterOrderKey;
}

export interface BatchInfo {
  batch: number;
  total: number;
  totalChapters?: number;
}
