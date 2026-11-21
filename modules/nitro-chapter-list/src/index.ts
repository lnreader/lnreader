import { NitroModules } from 'react-native-nitro-modules';
import type { ChapterListStore } from './specs/ChapterListStore.nitro';
// Re-exported under another name: RN's codegen Babel plugin reserves a
// `Commands` export for files that call codegenNativeCommands.
import ChapterListViewNativeComponent, {
  Commands as NativeCommands,
} from './fabric/ChapterListViewNativeComponent';

export const createChapterListStore = (): ChapterListStore =>
  NitroModules.createHybridObject<ChapterListStore>('ChapterListStore');

export const ChapterListViewCommands = NativeCommands;
export { ChapterListViewNativeComponent };
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
