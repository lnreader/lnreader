import * as Clipboard from 'expo-clipboard';
import { useNavigation } from '@react-navigation/native';
import { processColor } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import glyphs from '@react-native-vector-icons/material-design-icons/glyphmaps/MaterialDesignIcons.json';
import type {
  NovelDetails,
  NovelDetailsAction,
} from '@modules/nitro-chapter-list';
import type { ChapterInfo, NovelInfo } from '@database/types';
import type { NovelScreenProps } from '@navigators/types';
import type { ThemeColors } from '@theme/types';
import { filterColor } from '@theme/colors';
import type { MaterialDesignIconName } from '@type/icon';
import { isMissingNovelCover } from '@components/NovelCoverImage';
import { useAppSettings, useTrackedNovel, useTracker } from '@hooks/persisted';
import { AVAILABLE_PLUGINS } from '@hooks/persisted/usePlugins';
import type { UseBooleanReturnType } from '@hooks';
import { getString } from '@i18n/translations';
import { getPlugin } from '@plugins/pluginManager';
import { NovelStatus, type PluginItem } from '@plugins/types';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { showToast } from '@utils/showToast';
import { translateNovelStatus } from '@utils/translateEnum';
import { useNovelAction } from '../NovelContext';
import { parseGenres } from '../utils/genres';

const STATUS_ICONS = new Map<string, MaterialDesignIconName>([
  [NovelStatus.Ongoing, 'clock-outline'],
  [NovelStatus.Completed, 'check-all'],
  [NovelStatus.OnHiatus, 'pause-circle-outline'],
  [NovelStatus.Cancelled, 'cancel'],
  [NovelStatus.Licensed, 'copyright'],
  [NovelStatus.PublishingFinished, 'book-check-outline'],
  [NovelStatus.Unknown, 'help-circle-outline'],
  [NovelStatus.STUB, 'book-off-outline'],
  [NovelStatus.Inactive, 'sleep'],
]);

const getGlyph = (icon: MaterialDesignIconName) =>
  String.fromCodePoint(glyphs[icon]);

export type NovelAction = NovelDetailsAction & {
  run?: () => void;
  menu?: readonly NovelAction[];
};

export const novelAction = (
  id: string,
  label: string,
  icon?: MaterialDesignIconName,
  run?: () => void,
): NovelAction => ({
  id,
  label,
  glyph: icon ? getGlyph(icon) : undefined,
  run,
});

interface NativeNovelDetailsOptions {
  novel: NovelInfo | (Omit<NovelInfo, 'id'> & { id: 'NO_ID' });
  theme: ThemeColors;
  loading: boolean;
  fetching: boolean;
  error?: string;
  totalChapters?: number;
  hasFilters: boolean;
  hasDownloadedChapters: boolean;
  snackbar?: UseBooleanReturnType;
  selectionKey?: string;
  selectionHaptics: boolean;
  selectionToolbar: readonly NovelAction[];
  toolbar: readonly NovelAction[];
  selectionActions: readonly NovelAction[];
  pages: string[];
  pageIndex: number;
  lastRead?: ChapterInfo;
  firstUnreadChapter?: ChapterInfo;
  onRead: (chapter: ChapterInfo) => void;
  onResume: () => void;
  onOpenPage: (index: number) => void;
  onPages: () => void;
  onTracker: () => void;
  onEditCategories?: () => void;
  onEditCover: () => void;
  onSaveCover: () => void;
}

export const useNativeNovelDetails = ({
  novel,
  theme,
  loading,
  fetching,
  error,
  totalChapters,
  hasFilters,
  hasDownloadedChapters,
  snackbar,
  selectionKey,
  selectionHaptics,
  selectionToolbar,
  toolbar,
  selectionActions,
  pages,
  pageIndex,
  lastRead,
  firstUnreadChapter,
  onRead,
  onResume,
  onOpenPage,
  onPages,
  onTracker,
  onEditCategories,
  onEditCover,
  onSaveCover,
}: NativeNovelDetailsOptions) => {
  const navigation = useNavigation<NovelScreenProps['navigation']>();
  const followNovel = useNovelAction('followNovel');
  const { tracker } = useTracker();
  const { trackedNovel } = useTrackedNovel(novel.id);
  const {
    hideBackdrop = false,
    reduceAppAnimations = false,
    useFabForContinueReading = false,
  } = useAppSettings();
  const { top, bottom } = useSafeAreaInsets();
  const pluginName =
    getMMKVObject<PluginItem[]>(AVAILABLE_PLUGINS)?.find(
      plugin => plugin.id === novel.pluginId,
    )?.name ?? novel.pluginId;
  const coverHeaders = getPlugin(novel.pluginId)?.imageRequestInit?.headers;
  const status =
    novel.id !== 'NO_ID' && novel.status
      ? translateNovelStatus(novel.status)
      : getString('novelScreen.unknownStatus');

  const actions: NovelAction[] = [];
  if (novel.id !== 'NO_ID') {
    actions.push({
      ...novelAction(
        'follow',
        getString(
          novel.inLibrary
            ? 'novelScreen.inLibaray'
            : 'novelScreen.addToLibaray',
        ),
        novel.inLibrary ? 'heart' : 'heart-outline',
        async () => {
          if (loading) return;
          try {
            await followNovel();
            if (novel.inLibrary && hasDownloadedChapters) {
              snackbar?.setTrue();
            } else {
              snackbar?.setFalse();
            }
          } catch (followError) {
            showToast(
              followError instanceof Error
                ? followError.message
                : String(followError),
            );
          }
        },
      ),
      active: !!novel.inLibrary,
      longPressId: 'categories',
    });
    if (tracker) {
      actions.push({
        ...novelAction(
          'track',
          getString(
            trackedNovel ? 'novelScreen.tracked' : 'novelScreen.tracking',
          ),
          trackedNovel ? 'check' : 'sync',
          onTracker,
        ),
        active: !!trackedNovel,
      });
    }
    if (!novel.isLocal) {
      const savedNovel = novel;
      if (novel.inLibrary) {
        actions.push(
          novelAction(
            'migrate',
            getString('novelScreen.migrate'),
            'swap-vertical-variant',
            () => navigation.navigate('MigrateNovel', { novel: savedNovel }),
          ),
        );
      }
      actions.push(
        novelAction('webview', 'WebView', 'earth', () =>
          navigation.navigate('WebviewScreen', {
            name: novel.name,
            pluginId: novel.pluginId,
            url: novel.path,
            isNovel: true,
          }),
        ),
      );
    }
  }

  const pageActions: NovelAction[] = [];
  if (pages.length > 1) {
    if (pageIndex > 0) {
      pageActions.push(
        novelAction('previous-page', '‹', undefined, () =>
          onOpenPage(pageIndex - 1),
        ),
      );
    }
    const indices = [...new Set([0, pageIndex, pages.length - 1])].sort(
      (left, right) => left - right,
    );
    indices.forEach((index, position) => {
      if (position > 0 && index - indices[position - 1] > 1) {
        pageActions.push(novelAction('page-picker', '…', undefined, onPages));
      }
      pageActions.push({
        ...novelAction(`page-${index}`, pages[index], undefined, () => {
          if (index !== pageIndex) onOpenPage(index);
        }),
        active: index === pageIndex,
      });
    });
    if (pageIndex < pages.length - 1) {
      pageActions.push(
        novelAction('next-page', '›', undefined, () =>
          onOpenPage(pageIndex + 1),
        ),
      );
    }
  } else if ((novel.totalPages ?? 0) > 1) {
    pageActions.push(novelAction('page-picker', '…', undefined, onPages));
  }

  const target = lastRead ?? firstUnreadChapter;
  const read =
    !useFabForContinueReading && target
      ? novelAction(
          'read',
          lastRead
            ? `${getString('novelScreen.continueReading')} ${lastRead.name}`
            : getString('novelScreen.startReadingChapters', {
                name: target.name,
              }),
          undefined,
          () => onRead(target),
        )
      : undefined;
  const resume =
    useFabForContinueReading && target
      ? novelAction(
          'resume',
          lastRead
            ? getString('common.resume')
            : getString('novelScreen.startReadingChapters', {
                name: '',
              }).trim(),
          'play',
          onResume,
        )
      : undefined;
  const filter = {
    ...novelAction('filter', getString('common.filter'), 'filter-variant'),
    active: hasFilters,
  };
  const coverActions = [
    novelAction('dismiss-cover', getString('common.close'), 'close'),
    novelAction(
      'save-cover',
      getString('common.save'),
      'content-save',
      onSaveCover,
    ),
    novelAction(
      'edit-cover',
      getString('novelScreen.edit.cover'),
      'pencil-outline',
      onEditCover,
    ),
  ];
  const details: NovelDetails = {
    title: novel.name,
    author: novel.id === 'NO_ID' ? undefined : novel.author ?? undefined,
    artist: novel.id === 'NO_ID' ? undefined : novel.artist ?? undefined,
    source: `${status} • ${pluginName}`,
    authorGlyph: getGlyph('fountain-pen-tip'),
    artistGlyph: getGlyph('palette-outline'),
    sourceGlyph: getGlyph(STATUS_ICONS.get(novel.status ?? '') ?? 'help'),
    cover: isMissingNovelCover(novel.cover) ? undefined : novel.cover?.trim(),
    coverHeaders,
    coverLabel: novel.name,
    coverActions,
    coverGlyph: getGlyph('book-open-page-variant-outline'),
    summary:
      novel.summary || (loading ? '' : getString('novelScreen.noSummary')),
    expandLabel: getString('novelScreen.nativeDetails.expandSummary'),
    collapseLabel: getString('novelScreen.nativeDetails.collapseSummary'),
    expandGlyph: getGlyph('chevron-down'),
    collapseGlyph: getGlyph('chevron-up'),
    genres: parseGenres(novel.genres),
    expandedSummary: !novel.inLibrary && !loading,
    hideBackdrop,
    reduceMotion: reduceAppAnimations,
    busy: loading || (fetching && totalChapters === undefined),
    error,
    chapterLabel:
      novel.id === 'NO_ID'
        ? ''
        : `${totalChapters ?? 0} ${getString('novelScreen.chapters')}`,
    filter,
    filterActiveColor: Number(processColor(filterColor(theme.isDark))),
    actions,
    toolbar,
    selectionActions,
    selectionKey,
    selectionHaptics,
    selectionToolbar,
    read,
    resume,
    scrollToTop: novelAction(
      'top',
      getString('readerScreen.drawer.scrollToTop'),
      'arrow-up',
    ),
    pages: pageActions,
    topInset: top,
    bottomInset: bottom,
    background: Number(processColor(theme.background)),
    toolbarColor: Number(processColor(theme.surface2 || theme.surface)),
    errorColor: Number(processColor(theme.error)),
  };

  const callbacks = new Map<string, () => void>();
  const register = (item: NovelAction) => {
    if (item.run) callbacks.set(item.id, item.run);
    item.menu?.forEach(register);
  };
  [
    ...actions,
    ...toolbar,
    ...pageActions,
    ...coverActions,
    filter,
    ...(read ? [read] : []),
    ...(resume ? [resume] : []),
    novelAction('title', '', undefined, () =>
      navigation.replace('GlobalSearchScreen', { searchText: novel.name }),
    ),
    novelAction('copy-title', '', undefined, async () => {
      await Clipboard.setStringAsync(novel.name);
      showToast(getString('common.copiedToClipboard', { name: novel.name }));
    }),
    novelAction('categories', '', undefined, onEditCategories),
  ].forEach(register);

  return { details, onAction: (id: string) => callbacks.get(id)?.() };
};
