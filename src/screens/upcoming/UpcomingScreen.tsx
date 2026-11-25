import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Appbar as PaperAppbar } from 'react-native-paper';

import { Appbar, EmptyView, NovelCoverImage, SafeAreaView } from '@components';
import useBoolean from '@hooks/common/useBoolean';
import { useCategories, useLibrarySettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import type { UpcomingScreenProps } from '@navigators/types';
import { useLiveQuery } from '@database/manager/liveQuery';
import { getUpcomingNovelsQuery } from '@database/queries/LibraryQueries';
import { BUILT_IN_CATEGORY_IDS } from '@database/constants';
import { type Day, startOfLocalDay } from '@services/updates/releaseSchedule';
import GlobalUpdateCategoriesDialog from '@screens/settings/SettingsLibraryScreen/GlobalUpdateCategoriesDialog';
import UpcomingCalendar from './components/UpcomingCalendar';
import { useToday } from './useToday';
import {
  addMonths,
  firstOfMonth,
  groupUpcoming,
  type UpcomingRow,
} from './upcomingUtils';

const HEADER_HEIGHT = 48;
const ROW_HEIGHT = 64;

const rowHeight = (row: UpcomingRow) =>
  row.type === 'header' ? HEADER_HEIGHT : ROW_HEIGHT;

const relativeDay = (day: Day, today: Day) =>
  day <= today
    ? getString('upcomingScreen.today')
    : getString('upcomingScreen.relativeTime', { count: day - today });

const UpcomingScreen = ({ navigation }: UpcomingScreenProps) => {
  const theme = useTheme();
  const {
    upcomingIncludeCategoryIds = [],
    upcomingExcludeCategoryIds = [],
    setLibrarySettings,
  } = useLibrarySettings();
  const { categories } = useCategories();
  const filterCategories = categories.filter(
    category => category.id !== BUILT_IN_CATEGORY_IDS.local,
  );

  const today = useToday();
  const [month, setMonth] = useState(() => firstOfMonth(today));
  const [calendarHeight, setCalendarHeight] = useState(0);
  const listRef = useRef<FlatList<UpcomingRow>>(null);

  const novels = useLiveQuery(
    getUpcomingNovelsQuery(
      {
        includedCategoryIds: upcomingIncludeCategoryIds,
        excludedCategoryIds: upcomingExcludeCategoryIds,
      },
      startOfLocalDay(today).toISOString(),
    ),
    [{ table: 'Novel' }, { table: 'NovelCategory' }],
  );
  const { rows, headerIndexByDay, countByDay } = useMemo(
    () => groupUpcoming(novels),
    [novels],
  );

  const offsets = useMemo(() => {
    const result: number[] = [];
    let offset = calendarHeight;
    for (const row of rows) {
      result.push(offset);
      offset += rowHeight(row);
    }
    return result;
  }, [calendarHeight, rows]);

  const getItemLayout = useCallback(
    (_: ArrayLike<UpcomingRow> | null | undefined, index: number) => ({
      length: rowHeight(rows[index]),
      offset: offsets[index],
      index,
    }),
    [offsets, rows],
  );

  const onDayPress = useCallback(
    (day: Day) => {
      const index = headerIndexByDay.get(day);
      if (index !== undefined) {
        listRef.current?.scrollToIndex({ index, animated: true });
      }
    },
    [headerIndexByDay],
  );

  const filterDialog = useBoolean();
  const [draftIncluded, setDraftIncluded] = useState<number[]>([]);
  const [draftExcluded, setDraftExcluded] = useState<number[]>([]);
  const isFiltered =
    upcomingIncludeCategoryIds.length > 0 ||
    upcomingExcludeCategoryIds.length > 0;

  const openFilter = () => {
    setDraftIncluded(upcomingIncludeCategoryIds);
    setDraftExcluded(upcomingExcludeCategoryIds);
    filterDialog.setTrue();
  };
  const onFilterChange = useCallback(
    (included: number[], excluded: number[]) => {
      setDraftIncluded(included);
      setDraftExcluded(excluded);
    },
    [],
  );
  const saveFilter = () => {
    setLibrarySettings({
      upcomingIncludeCategoryIds: draftIncluded,
      upcomingExcludeCategoryIds: draftExcluded,
    });
    filterDialog.setFalse();
  };

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<UpcomingRow>) => {
      if (item.type === 'header') {
        return (
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: theme.onSurface }]}>
              {relativeDay(item.day, today)}
            </Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: theme.secondaryContainer },
              ]}
            >
              <Text style={{ color: theme.onSecondaryContainer }}>
                {item.count}
              </Text>
            </View>
          </View>
        );
      }
      const { novel } = item;
      return (
        <Pressable
          android_ripple={{ color: theme.rippleColor }}
          style={styles.row}
          onPress={() =>
            navigation.navigate('ReaderStack', {
              screen: 'Novel',
              params: {
                pluginId: novel.pluginId,
                path: novel.path,
                cover: novel.cover,
                name: novel.name,
                inLibrary: true,
              },
            })
          }
        >
          <NovelCoverImage
            uri={novel.cover}
            theme={theme}
            style={styles.cover}
            recyclingKey={item.key}
          />
          <Text
            numberOfLines={2}
            style={[styles.title, { color: theme.onSurface }]}
          >
            {novel.name}
          </Text>
        </Pressable>
      );
    },
    [navigation, theme, today],
  );

  return (
    <SafeAreaView excludeTop>
      <Appbar
        title={getString('upcomingScreen.title')}
        handleGoBack={navigation.goBack}
        theme={theme}
        mode="small"
      >
        <PaperAppbar.Action
          icon="filter-variant"
          iconColor={isFiltered ? theme.primary : theme.onSurface}
          accessibilityLabel={getString('common.filter')}
          onPress={openFilter}
        />
      </Appbar>
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={row => row.key}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={
          <View
            onLayout={(event: LayoutChangeEvent) =>
              setCalendarHeight(event.nativeEvent.layout.height)
            }
          >
            <UpcomingCalendar
              month={month}
              today={today}
              countByDay={countByDay}
              onPreviousMonth={() => setMonth(m => addMonths(m, -1))}
              onNextMonth={() => setMonth(m => addMonths(m, 1))}
              onDayPress={onDayPress}
              theme={theme}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyView
            icon="(˘･_･˘)"
            description={getString('upcomingScreen.emptyView')}
            theme={theme}
          />
        }
      />
      {filterDialog.value ? (
        <GlobalUpdateCategoriesDialog
          visible
          categories={filterCategories}
          includedCategoryIds={draftIncluded}
          excludedCategoryIds={draftExcluded}
          title={getString('common.categories')}
          description={getString('upcomingScreen.categoriesDescription')}
          onChange={onFilterChange}
          onCancel={filterDialog.setFalse}
          onSave={saveFilter}
        />
      ) : null}
    </SafeAreaView>
  );
};

export default UpcomingScreen;

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 12,
    minWidth: 24,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  cover: {
    borderRadius: 4,
    height: 56,
    width: 40,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: HEADER_HEIGHT,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    height: ROW_HEIGHT,
    paddingHorizontal: 16,
  },
  title: {
    flex: 1,
    fontSize: 15,
  },
});
