import { NitroModules } from 'react-native-nitro-modules';
import type { ChapterListStore } from './specs/ChapterListStore.nitro';

export const createChapterListStore = (): ChapterListStore =>
  NitroModules.createHybridObject<ChapterListStore>('ChapterListStore');

export {
  default as ChapterListViewNativeComponent,
  Commands as ChapterListViewCommands,
} from './fabric/ChapterListViewNativeComponent';
export type {
  ChapterIdEvent,
  ChapterListColors,
  ChapterListScrollEvent,
  ChapterListStrings,
  NativeProps as ChapterListViewNativeProps,
  RequestRangeEvent,
} from './fabric/ChapterListViewNativeComponent';
export type {
  ChapterListStore,
  ChapterRow,
} from './specs/ChapterListStore.nitro';
