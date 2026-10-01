import React, { useMemo, useState } from 'react';
import { Column, ListItem } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding } from '@expo/ui/jetpack-compose/modifiers';

import {
  AppIcon,
  AppText,
  NovelCoverImage,
  SegmentedControl,
  listItemColors,
} from '@components';
import { getString } from '@i18n/translations';
import { getPlugin } from '@plugins/pluginManager';
import LabelIcon from '@expo/material-symbols/label.xml';
import { formatTimeSpent } from './utils';
import { StatsCard } from './components';
import { StatsList } from './components/StatsCard';

import type { ThemeColors } from '@theme/types';
import type { LibraryStats } from '@database/types';

type TimeSpentItem =
  | {
      type: 'novel';
      id: number;
      pluginId: string;
      name: string;
      cover: string | null;
      timeSpent: number;
    }
  | { type: 'category'; id: number; name: string; timeSpent: number };

interface TimeTabProps {
  stats: LibraryStats;
  theme: ThemeColors;
}

const TimeRow = ({
  item,
  theme,
}: {
  item: TimeSpentItem;
  theme: ThemeColors;
}) => (
  <ListItem colors={listItemColors(theme)} modifiers={[fillMaxWidth()]}>
    <ListItem.LeadingContent>
      {item.type === 'novel' ? (
        <NovelCoverImage
          uri={item.cover}
          requestInit={getPlugin(item.pluginId)?.imageRequestInit}
          width={40}
          height={56}
          corner={8}
          label={item.name}
          theme={theme}
        />
      ) : (
        <AppIcon source={LabelIcon} />
      )}
    </ListItem.LeadingContent>
    <ListItem.HeadlineContent>
      <AppText variant="bodyLarge" maxLines={2}>
        {item.name}
      </AppText>
    </ListItem.HeadlineContent>
    <ListItem.SupportingContent>
      <AppText variant="bodySmall" color={theme.onSurfaceVariant}>
        {formatTimeSpent(item.timeSpent)}
      </AppText>
    </ListItem.SupportingContent>
  </ListItem>
);

export const TimeTab: React.FC<TimeTabProps> = ({ stats, theme }) => {
  const [showingNovels, setShowingNovels] = useState(true);

  const timeSpentData = useMemo<TimeSpentItem[]>(() => {
    if (showingNovels) {
      return (stats.topNovelsByTimeSpent ?? []).map(n => ({
        type: 'novel' as const,
        id: n.id,
        pluginId: n.pluginId,
        name: n.name,
        cover: n.cover,
        timeSpent: n.timeSpent,
      }));
    }
    return (stats.topCategoriesByTimeSpent ?? []).map(c => ({
      type: 'category' as const,
      id: c.id,
      name: c.name,
      timeSpent: c.timeSpent,
    }));
  }, [
    showingNovels,
    stats.topNovelsByTimeSpent,
    stats.topCategoriesByTimeSpent,
  ]);

  const rows = [
    {
      key: 'total-time',
      render: () => (
        <StatsCard>
          <AppText variant="displaySmall" color={theme.primary}>
            {formatTimeSpent(stats.totalTimeSpent)}
          </AppText>
          <AppText variant="bodyMedium" color={theme.onSurfaceVariant}>
            {getString('statsScreen.totalTimeSpent')}
          </AppText>
        </StatsCard>
      ),
    },
    {
      key: 'grouping',
      render: () => (
        <Column
          verticalArrangement={{ spacedBy: 8 }}
          modifiers={[fillMaxWidth(), padding(0, 12, 0, 0)]}
        >
          <AppText variant="titleMedium">
            {showingNovels
              ? getString('statsScreen.topNovelsByTimeSpent')
              : getString('statsScreen.topCategoriesByTimeSpent')}
          </AppText>
          <SegmentedControl
            options={[
              { label: getString('statsScreen.showNovels'), value: 'novels' },
              {
                label: getString('statsScreen.showCategories'),
                value: 'categories',
              },
            ]}
            value={showingNovels ? 'novels' : 'categories'}
            onChange={value => setShowingNovels(value === 'novels')}
            modifiers={[fillMaxWidth()]}
            theme={theme}
          />
        </Column>
      ),
    },
    ...timeSpentData.map(item => ({
      key: `${item.type}-${item.id}`,
      render: () => <TimeRow item={item} theme={theme} />,
    })),
  ];

  return <StatsList rows={rows} />;
};
