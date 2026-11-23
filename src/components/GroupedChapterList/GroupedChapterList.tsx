import { type ReactNode, useLayoutEffect, useMemo, useState } from 'react';
import {
  type NativeSyntheticEvent,
  processColor,
  StyleSheet,
  View,
} from 'react-native';
import { type NavigationProp, useNavigation } from '@react-navigation/native';
import {
  createGroupedChapterListStore,
  type GroupedChapterRow,
  GroupedChapterListViewNativeComponent,
  type GroupedRowEvent,
} from '@modules/nitro-chapter-list';

import type { DownloadedChapter, NovelInfo } from '@database/types';
import useDownload from '@hooks/persisted/useDownload';
import { getString } from '@i18n/translations';
import type { RootStackParamList } from '@navigators/types';
import type { ThemeColors } from '@theme/types';
import { parseChapterNumber } from '@utils/parseChapterNumber';
import { isMissingNovelCover } from '@components/NovelCoverImage';

export interface ChapterGroup {
  key: string;
  novel: NovelInfo;
  count: number;
  chapters?: readonly DownloadedChapter[];
}

export interface ChapterGroupSection {
  key: string;
  title?: string;
  groups: ChapterGroup[];
}

export const toggleChapterGroup = (
  expanded: ReadonlySet<string>,
  key: string,
): ReadonlySet<string> => {
  const next = new Set(expanded);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
};

interface Props {
  sections: ChapterGroupSection[];
  expanded: ReadonlySet<string>;
  onToggleGroup: (key: string) => void;
  onDeleteChapter: (chapter: DownloadedChapter) => void;
  onRefresh?: () => void;
  theme: ThemeColors;
  countLabel: string;
  header?: ReactNode;
  empty?: ReactNode;
}

type RowAction =
  | { novel: NovelInfo; chapter: DownloadedChapter }
  | { novel: NovelInfo; groupKey: string };

const chapterKey = (id: number) => `chapter-${id}`;
const color = (value?: string) => (processColor(value) as number | null) ?? 0;

const GroupedChapterList = ({
  sections,
  expanded,
  onToggleGroup,
  onDeleteChapter,
  onRefresh,
  theme,
  countLabel,
  header,
  empty,
}: Props) => {
  const [store] = useState(createGroupedChapterListStore);
  const { navigate } = useNavigation<NavigationProp<RootStackParamList>>();
  const { downloadChapter, downloadingChapterIds } = useDownload();

  const { rows, actions } = useMemo(() => {
    const nativeRows: GroupedChapterRow[] = [];
    const rowActions = new Map<string, RowAction>();
    for (const section of sections) {
      if (section.title) {
        nativeRows.push({
          key: `date-${section.key}`,
          kind: 'label',
          title: section.title,
        });
      }
      for (const group of section.groups) {
        const { novel } = group;
        const cover = isMissingNovelCover(novel.cover)
          ? undefined
          : novel.cover?.trim();
        if (group.count > 1) {
          const key = `group-${group.key}`;
          const open = expanded.has(group.key);
          nativeRows.push({
            key,
            kind: 'group',
            title: novel.name,
            subtitle: `${group.count} ${countLabel}`,
            cover,
            expanded: open,
          });
          rowActions.set(key, { novel, groupKey: group.key });
          if (!open) {
            continue;
          }
        }
        if (!group.chapters) {
          nativeRows.push({
            key: `loading-${group.key}`,
            kind: 'loading',
            title: '',
          });
          continue;
        }
        for (const chapter of group.chapters) {
          const key = chapterKey(chapter.id);
          const chapterNumber =
            chapter.chapterNumber ||
            parseChapterNumber(novel.name, chapter.name);
          nativeRows.push({
            key,
            kind: 'chapter',
            title: novel.name,
            subtitle: String(chapterNumber),
            cover,
            unread: !!chapter.unread,
            bookmarked: !!chapter.bookmark,
            downloaded: !!chapter.isDownloaded,
          });
          rowActions.set(key, {
            novel,
            chapter:
              chapter.chapterNumber === chapterNumber
                ? chapter
                : { ...chapter, chapterNumber },
          });
        }
      }
    }
    return { rows: nativeRows, actions: rowActions };
  }, [countLabel, expanded, sections]);

  useLayoutEffect(() => {
    store.setRows(rows);
  }, [rows, store]);

  const colors = useMemo(
    () => ({
      onSurface: color(theme.onSurface),
      onSurfaceVariant: color(theme.onSurfaceVariant),
      outline: color(theme.outline),
      primary: color(theme.primary),
      onPrimary: color(theme.onPrimary),
      rippleColor: color(theme.rippleColor ?? theme.outlineVariant),
      surfaceVariant: color(theme.surfaceVariant),
    }),
    [theme],
  );
  const strings = useMemo(
    () => ({
      chapterTitleTemplate: getString('novelScreen.chapterChapnum', {
        num: '%{num}',
      }),
      deleteLabel: getString('common.delete'),
      downloadA11yLabel: getString('novelScreen.chapterDownloadA11y'),
      deleteA11yLabel: getString('novelScreen.chapterDeleteA11y'),
      downloadingA11yLabel: getString('novelScreen.chapterDownloadingA11y'),
    }),
    [],
  );
  const downloadingIds = useMemo(
    () => Array.from(downloadingChapterIds, chapterKey),
    [downloadingChapterIds],
  );

  const onRowPress = ({
    nativeEvent,
  }: NativeSyntheticEvent<GroupedRowEvent>) => {
    const action = actions.get(nativeEvent.key);
    if (!action) {
      return;
    }
    if ('groupKey' in action) {
      onToggleGroup(action.groupKey);
    } else {
      navigate('ReaderStack', {
        screen: 'Chapter',
        params: { novel: action.novel, chapter: action.chapter },
      });
    }
  };

  const onCoverPress = ({
    nativeEvent,
  }: NativeSyntheticEvent<GroupedRowEvent>) => {
    const novel = actions.get(nativeEvent.key)?.novel;
    if (novel) {
      navigate('ReaderStack', {
        screen: 'Novel',
        params: {
          pluginId: novel.pluginId,
          path: novel.path,
          cover: novel.cover,
          name: novel.name,
          inLibrary: novel.inLibrary,
        },
      });
    }
  };

  return (
    <View style={styles.list}>
      <GroupedChapterListViewNativeComponent
        style={styles.list}
        storeId={store.id}
        colors={colors}
        strings={strings}
        downloadingIds={downloadingIds}
        refreshEnabled={!!onRefresh}
        onRefresh={onRefresh}
        onRowPress={onRowPress}
        onCoverPress={onCoverPress}
        onDownloadPress={({ nativeEvent }) => {
          const action = actions.get(nativeEvent.key);
          if (action && 'chapter' in action) {
            downloadChapter(action.novel, action.chapter);
          }
        }}
        onDeletePress={({ nativeEvent }) => {
          const action = actions.get(nativeEvent.key);
          if (action && 'chapter' in action) {
            onDeleteChapter(action.chapter);
          }
        }}
      >
        <View collapsable={false} style={styles.header}>
          {header}
        </View>
      </GroupedChapterListViewNativeComponent>
      {empty && rows.length === 0 ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {empty}
        </View>
      ) : null}
    </View>
  );
};

export default GroupedChapterList;

const styles = StyleSheet.create({
  list: { flex: 1 },
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
});
