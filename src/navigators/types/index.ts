import { ChapterInfo, NovelInfo } from '@database/types';
import {
  CompositeScreenProps,
  NavigatorScreenParams,
} from '@react-navigation/native';
import { StackScreenProps } from '@react-navigation/stack';
import { MaterialBottomTabScreenProps } from 'react-native-paper';

export type RootStackParamList = {
  BottomNavigator: NavigatorScreenParams<BottomNavigatorParamList> | undefined;
  ReaderStack: NavigatorScreenParams<ReaderStackParamList>;
  MoreStack: NavigatorScreenParams<MoreStackParamList>;
  SourceScreen: {
    pluginId: string;
    pluginName: string;
    site: string;
    showLatestNovels?: boolean;
  };
  BrowseMal: undefined;
  BrowseAL: undefined;
  BrowseSettings: undefined;
  GlobalSearchScreen: { searchText?: string };
  Migration: undefined;
  SourceNovels: { pluginId: string };
  MigrateNovel: { novel: NovelInfo };
  WebviewScreen: {
    name: string;
    url: string;
    pluginId: string;
    isNovel?: boolean;
  };
};

export type BottomNavigatorParamList = {
  Library: undefined;
  Updates: undefined;
  History: undefined;
  Browse: undefined;
  More: undefined;
};

export type LibraryScreenProps = CompositeScreenProps<
  MaterialBottomTabScreenProps<BottomNavigatorParamList, 'Library'>,
  StackScreenProps<RootStackParamList>
>;

export type HistoryScreenProps = CompositeScreenProps<
  MaterialBottomTabScreenProps<BottomNavigatorParamList, 'History'>,
  StackScreenProps<RootStackParamList>
>;

export type UpdateScreenProps = CompositeScreenProps<
  MaterialBottomTabScreenProps<BottomNavigatorParamList, 'Updates'>,
  StackScreenProps<RootStackParamList>
>;

export type BrowseScreenProps = CompositeScreenProps<
  MaterialBottomTabScreenProps<BottomNavigatorParamList, 'Browse'>,
  StackScreenProps<RootStackParamList>
>;

export type MoreStackScreenProps = CompositeScreenProps<
  MaterialBottomTabScreenProps<BottomNavigatorParamList, 'More'>,
  StackScreenProps<RootStackParamList, 'MoreStack'>
>;
export type MoreStackParamList = {
  SettingsStack: NavigatorScreenParams<SettingsStackParamList>;
  About: undefined;
  TaskQueue: undefined;
  Downloads: undefined;
  Categories: undefined;
  Statistics: undefined;
};

export type SettingsStackParamList = {
  Settings: undefined;
  GeneralSettings: undefined;
  ReaderSettings: undefined;
  TrackerSettings: undefined;
  BackupSettings: undefined;
  AppearanceSettings: undefined;
  AdvancedSettings: undefined;
  LibrarySettings: undefined;
  RespositorySettings: { url?: string } | undefined;
};

export type NovelScreenProps = StackScreenProps<
  ReaderStackParamList & RootStackParamList,
  'Novel'
>;
export type ChapterScreenProps = StackScreenProps<
  ReaderStackParamList & RootStackParamList,
  'Chapter'
>;
export type ReaderStackParamList = {
  Novel:
    | {
        name: string;
        path: string;
        pluginId: string;
        cover: string | null;
        isLocal?: boolean | null;
      }
    | Omit<NovelInfo, 'id'>;
  Chapter: {
    novel: NovelInfo;
    chapter: ChapterInfo;
  };
};

export type AboutScreenProps = StackScreenProps<MoreStackParamList, 'About'>;
export type DownloadsScreenProps = StackScreenProps<
  MoreStackParamList,
  'Downloads'
>;
export type TaskQueueScreenProps = StackScreenProps<
  MoreStackParamList,
  'TaskQueue'
>;
export type BrowseSourceScreenProps = StackScreenProps<
  RootStackParamList,
  'SourceScreen'
>;
export type BrowseMalScreenProps = StackScreenProps<
  RootStackParamList,
  'BrowseMal'
>;
export type BrowseALScreenProps = StackScreenProps<
  RootStackParamList,
  'BrowseAL'
>;
export type BrowseSettingsScreenProp = StackScreenProps<
  RootStackParamList,
  'BrowseSettings'
>;
export type GlobalSearchScreenProps = StackScreenProps<
  RootStackParamList,
  'GlobalSearchScreen'
>;
export type MigrationScreenProps = StackScreenProps<
  RootStackParamList,
  'Migration'
>;
export type MigrateNovelScreenProps = StackScreenProps<
  RootStackParamList,
  'MigrateNovel'
>;
export type SourceNovelsScreenProps = StackScreenProps<
  RootStackParamList,
  'SourceNovels'
>;
export type WebviewScreenProps = StackScreenProps<
  RootStackParamList,
  'WebviewScreen'
>;
export type SettingsScreenProps = CompositeScreenProps<
  StackScreenProps<SettingsStackParamList, 'Settings'>,
  StackScreenProps<MoreStackParamList, 'SettingsStack'>
>;
export type AppearanceSettingsScreenProps = StackScreenProps<
  SettingsStackParamList,
  'AppearanceSettings'
>;
export type TrackerSettingsScreenProps = StackScreenProps<
  SettingsStackParamList,
  'TrackerSettings'
>;
export type BackupSettingsScreenProps = StackScreenProps<
  SettingsStackParamList,
  'BackupSettings'
>;
export type AdvancedSettingsScreenProps = StackScreenProps<
  SettingsStackParamList,
  'AdvancedSettings'
>;

export type RespositorySettingsScreenProps = CompositeScreenProps<
  StackScreenProps<SettingsStackParamList, 'RespositorySettings'>,
  StackScreenProps<RootStackParamList, 'BottomNavigator'>
>;

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
