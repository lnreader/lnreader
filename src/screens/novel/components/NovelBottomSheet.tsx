import { useCallback, useState, useMemo } from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, height } from '@expo/ui/jetpack-compose/modifiers';

import { getString } from '@i18n/translations';

import { Checkbox, SortItem } from '@components/Checkbox/Checkbox';
import { BottomSheet, ComposeTabPager, Dialog, List } from '@components';

import { useNovelSettings } from '@hooks/persisted/useNovelSettings';
import { useNovelValue } from '@screens/novel/NovelContext';
import ChevronRightIcon from '@expo/material-symbols/chevron_right.xml';
import { ThemeColors } from '@theme/types';

const SHEET_HEIGHT = 290;

interface ChaptersSettingsSheetProps {
  visible: boolean;
  onDismiss: () => void;
  theme: ThemeColors;
}

type SettingsRoute = {
  key: 'first' | 'second' | 'third';
  title: string;
};

const ChaptersSettingsSheet = ({
  visible,
  onDismiss,
  theme,
}: ChaptersSettingsSheetProps) => {
  const {
    setChapterSort,
    getChapterFilterState,
    cycleChapterFilter,
    setChapterFilterValue,
    setShowChapterTitles,
    sort,
    showChapterTitles,
    excludedScanlators = [],
    setExcludedScanlators,
  } = useNovelSettings();

  const rawScanlators = useNovelValue('scanlators');
  const scanlators = useMemo(
    () => [...(rawScanlators ?? [])].sort((a, b) => a.localeCompare(b)),
    [rawScanlators],
  );
  const [scanlatorsModalVisible, setScanlatorsModalVisible] = useState(false);
  const [tempExcludedScanlators, setTempExcludedScanlators] = useState<
    string[]
  >([]);

  const toggleTempScanlator = useCallback(
    (scanlator: string) => {
      const nextExcluded = tempExcludedScanlators.includes(scanlator)
        ? tempExcludedScanlators.filter(s => s !== scanlator)
        : [...tempExcludedScanlators, scanlator];
      setTempExcludedScanlators(nextExcluded);
    },
    [tempExcludedScanlators],
  );

  const readStatus = getChapterFilterState('read');
  const unreadStatus =
    readStatus === 'indeterminate'
      ? true
      : readStatus
      ? 'indeterminate'
      : false;

  const renderFilters = () => (
    <Column modifiers={[fillMaxWidth()]}>
      <Checkbox
        label={getString('novelScreen.bottomSheet.filters.downloaded')}
        status={getChapterFilterState('downloaded')}
        onPress={() => {
          cycleChapterFilter('downloaded');
        }}
        theme={theme}
      />
      <Checkbox
        label={getString('novelScreen.bottomSheet.filters.unread')}
        status={unreadStatus}
        onPress={() => {
          switch (readStatus) {
            case 'indeterminate':
              setChapterFilterValue('read', 'ON');
              break;
            case true:
              setChapterFilterValue('read', 'OFF');
              break;
            default:
              setChapterFilterValue('read', 'INDETERMINATE');
          }
        }}
        theme={theme}
      />
      <Checkbox
        label={getString('novelScreen.bottomSheet.filters.bookmarked')}
        status={getChapterFilterState('bookmarked')}
        onPress={() => {
          cycleChapterFilter('bookmarked');
        }}
        theme={theme}
      />
      {scanlators.length > 0 && (
        <>
          <List.Divider theme={theme} />
          <List.Item
            title={getString('novelScreen.bottomSheet.filters.scanlators')}
            right={ChevronRightIcon}
            onPress={() => {
              setTempExcludedScanlators(excludedScanlators);
              setScanlatorsModalVisible(true);
            }}
            theme={theme}
          />
        </>
      )}
    </Column>
  );

  const renderSort = () => (
    <Column modifiers={[fillMaxWidth()]}>
      <SortItem
        label={getString('novelScreen.bottomSheet.order.bySource')}
        status={
          sort === 'positionAsc'
            ? 'asc'
            : sort === 'positionDesc'
            ? 'desc'
            : undefined
        }
        onPress={() =>
          sort === 'positionAsc'
            ? setChapterSort('positionDesc')
            : setChapterSort('positionAsc')
        }
        theme={theme}
      />
      <SortItem
        label={getString('novelScreen.bottomSheet.order.byChapterName')}
        status={
          sort === 'nameAsc' ? 'asc' : sort === 'nameDesc' ? 'desc' : undefined
        }
        onPress={() =>
          sort === 'nameAsc'
            ? setChapterSort('nameDesc')
            : setChapterSort('nameAsc')
        }
        theme={theme}
      />
    </Column>
  );

  const renderDisplay = () => (
    <Column modifiers={[fillMaxWidth()]}>
      <Checkbox
        status={showChapterTitles ?? true}
        label={getString('novelScreen.bottomSheet.displays.sourceTitle')}
        onPress={() => setShowChapterTitles(true)}
        theme={theme}
      />
      <Checkbox
        status={!showChapterTitles}
        label={getString('novelScreen.bottomSheet.displays.chapterNumber')}
        onPress={() => setShowChapterTitles(false)}
        theme={theme}
      />
    </Column>
  );

  const renderScene = ({ route }: { route: SettingsRoute }) => {
    switch (route.key) {
      case 'first':
        return renderFilters();
      case 'second':
        return renderSort();
      case 'third':
        return renderDisplay();
    }
  };

  const [index, setIndex] = useState(0);
  const [routes] = useState<SettingsRoute[]>([
    { key: 'first', title: getString('common.filter') },
    { key: 'second', title: getString('common.sort') },
    { key: 'third', title: getString('common.display') },
  ]);

  return (
    <>
      <BottomSheet visible={visible} onDismiss={onDismiss} scrollable={false}>
        {/* A fixed height, as before, so switching tabs doesn't resize it. */}
        <Column modifiers={[fillMaxWidth(), height(SHEET_HEIGHT)]}>
          <ComposeTabPager
            tabs={routes.map((route, i) => ({ key: i, label: route.title }))}
            index={index}
            onIndexChange={setIndex}
            swipeEnabled={false}
            renderPage={page => renderScene({ route: routes[page] })}
            fixed
          />
        </Column>
      </BottomSheet>
      {scanlators.length > 0 && (
        <Dialog.Root
          visible={scanlatorsModalVisible}
          onDismiss={() => setScanlatorsModalVisible(false)}
        >
          <Dialog.Title>
            {getString('novelScreen.bottomSheet.filters.scanlators')}
          </Dialog.Title>
          <Dialog.Content>
            <Column modifiers={[fillMaxWidth()]}>
              {scanlators.map(scanlator => (
                <Checkbox
                  key={scanlator}
                  label={scanlator}
                  status={tempExcludedScanlators.includes(scanlator)}
                  onPress={() => toggleTempScanlator(scanlator)}
                  theme={theme}
                />
              ))}
            </Column>
          </Dialog.Content>
          <Dialog.Actions>
            <Dialog.Action onPress={() => setTempExcludedScanlators([])}>
              {getString('common.reset')}
            </Dialog.Action>
            <Dialog.Action onPress={() => setScanlatorsModalVisible(false)}>
              {getString('common.cancel')}
            </Dialog.Action>
            <Dialog.Action
              onPress={() => {
                setExcludedScanlators(tempExcludedScanlators);
                setScanlatorsModalVisible(false);
              }}
            >
              {getString('common.submit')}
            </Dialog.Action>
          </Dialog.Actions>
        </Dialog.Root>
      )}
    </>
  );
};

export default ChaptersSettingsSheet;
