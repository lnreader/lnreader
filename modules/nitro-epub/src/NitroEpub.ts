import type { HybridObject } from 'react-native-nitro-modules';

export interface EpubChapter {
  name: string;
  path: string;
}

export interface EpubNovel {
  name: string;
  cover: string | null;
  summary: string | null;
  author: string | null;
  artist: string | null;
  chapters: EpubChapter[];
  cssPaths: string[];
  imagePaths: string[];
}

export interface Epub extends HybridObject<{ android: 'c++'; ios: 'c++' }> {
  parseNovelAndChapters(epubDirPath: string): EpubNovel;
}
