import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getString } from '@i18n/translations';
import { useAppSettings } from '@hooks/persisted';
import type { BottomNavigatorParamList, MoreStackParamList } from './types';
import BarChartIcon from '@expo/material-symbols/bar_chart.xml';
import CollectionsBookmarkIcon from '@expo/material-symbols/collections_bookmark.xml';
import DownloadIcon from '@expo/material-symbols/download.xml';
import ExploreIcon from '@expo/material-symbols/explore.xml';
import HistoryIcon from '@expo/material-symbols/history.xml';
import LabelIcon from '@expo/material-symbols/label.xml';
import MoreHorizIcon from '@expo/material-symbols/more_horiz.xml';
import PendingActionsIcon from '@expo/material-symbols/pending_actions.xml';
import ReleaseAlertIcon from '@expo/material-symbols/release_alert.xml';
import SettingsIcon from '@expo/material-symbols/settings.xml';
import { railHeightFor, type IconSource } from '@components';
import { useWindowLayout } from '@hooks/common/useWindowLayout';

export type TabName = keyof BottomNavigatorParamList;

export const TAB_ICONS: Record<TabName, { icon: IconSource }> = {
  Library: {
    icon: CollectionsBookmarkIcon,
  },
  Updates: { icon: ReleaseAlertIcon },
  History: { icon: HistoryIcon },
  Browse: { icon: ExploreIcon },
  More: { icon: MoreHorizIcon },
};

export const isTabName = (name: string): name is TabName => name in TAB_ICONS;

export type MoreDestinationName = Exclude<keyof MoreStackParamList, 'About'>;

export const MORE_DESTINATIONS: readonly {
  name: MoreDestinationName;
  icon: IconSource;
  label: () => string;
}[] = [
  {
    name: 'TaskQueue',
    icon: PendingActionsIcon,
    label: () => getString('moreScreen.taskQueue'),
  },
  {
    name: 'Downloads',
    icon: DownloadIcon,
    label: () => getString('common.downloads'),
  },
  {
    name: 'Categories',
    icon: LabelIcon,
    label: () => getString('common.categories'),
  },
  {
    name: 'Statistics',
    icon: BarChartIcon,
    label: () => getString('statsScreen.title'),
  },
  {
    name: 'SettingsStack',
    icon: SettingsIcon,
    label: () => getString('common.settings'),
  },
];

export const isMoreDestination = (name: string): name is MoreDestinationName =>
  MORE_DESTINATIONS.some(destination => destination.name === name);

// `extended`: tall enough to list the More screens directly, so the More tab
// is left out (its toggles and About move into Settings).
export const useRailLayout = () => {
  const layout = useWindowLayout();
  const { top, bottom } = useSafeAreaInsets();
  const { showHistoryTab = true, showUpdatesTab = true } = useAppSettings();
  const tabs = 2 + Number(showHistoryTab) + Number(showUpdatesTab);
  const extended =
    layout.useNavigationRail &&
    layout.height - top - bottom >=
      railHeightFor(tabs + MORE_DESTINATIONS.length, 2);
  return { rail: layout.useNavigationRail, extended };
};
