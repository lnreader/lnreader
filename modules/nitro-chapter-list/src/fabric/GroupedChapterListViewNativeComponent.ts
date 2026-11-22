import type { HostComponent, ViewProps } from 'react-native';
import codegenNativeComponent from 'react-native/Libraries/Utilities/codegenNativeComponent';
import type {
  DirectEventHandler,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

export type GroupedRowEvent = Readonly<{ key: string }>;

export interface NativeProps extends ViewProps {
  storeId: string;
  colors: Readonly<{
    onSurface: Int32;
    onSurfaceVariant: Int32;
    outline: Int32;
    primary: Int32;
    onPrimary: Int32;
    rippleColor: Int32;
    surfaceVariant: Int32;
  }>;
  strings: Readonly<{
    chapterTitleTemplate: string;
    deleteLabel: string;
    downloadA11yLabel: string;
    deleteA11yLabel: string;
    downloadingA11yLabel: string;
  }>;
  downloadingIds?: ReadonlyArray<string>;
  refreshEnabled?: WithDefault<boolean, false>;
  onRefresh?: DirectEventHandler<Readonly<{}>>;
  onRowPress?: DirectEventHandler<GroupedRowEvent>;
  onCoverPress?: DirectEventHandler<GroupedRowEvent>;
  onDownloadPress?: DirectEventHandler<GroupedRowEvent>;
  onDeletePress?: DirectEventHandler<GroupedRowEvent>;
}

export default codegenNativeComponent<NativeProps>(
  'LNGroupedChapterListView',
) as HostComponent<NativeProps>;
