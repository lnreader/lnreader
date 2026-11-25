import {
  type CodegenTypes,
  type HostComponent,
  type ViewProps,
  codegenNativeComponent,
} from 'react-native';

export type GroupedRowEvent = Readonly<{ key: string }>;

export interface NativeProps extends ViewProps {
  storeId: string;
  colors: Readonly<{
    onSurface: CodegenTypes.Int32;
    onSurfaceVariant: CodegenTypes.Int32;
    outline: CodegenTypes.Int32;
    primary: CodegenTypes.Int32;
    onPrimary: CodegenTypes.Int32;
    rippleColor: CodegenTypes.Int32;
    surfaceVariant: CodegenTypes.Int32;
  }>;
  strings: Readonly<{
    chapterTitleTemplate: string;
    deleteLabel: string;
    downloadA11yLabel: string;
    deleteA11yLabel: string;
    downloadingA11yLabel: string;
  }>;
  downloadingIds?: ReadonlyArray<string>;
  refreshEnabled?: CodegenTypes.WithDefault<boolean, false>;
  onRefresh?: CodegenTypes.DirectEventHandler<Readonly<{}>>;
  onRowPress?: CodegenTypes.DirectEventHandler<GroupedRowEvent>;
  onCoverPress?: CodegenTypes.DirectEventHandler<GroupedRowEvent>;
  onDownloadPress?: CodegenTypes.DirectEventHandler<GroupedRowEvent>;
  onDeletePress?: CodegenTypes.DirectEventHandler<GroupedRowEvent>;
}

export default codegenNativeComponent<NativeProps>(
  'LNGroupedChapterListView',
) as HostComponent<NativeProps>;
