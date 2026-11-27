import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
  type ScrollViewInstance,
} from 'react-native';
import React, { Ref, RefObject, useState, useCallback, Suspense } from 'react';
import Color from 'color';

import BottomSheet, {
  BottomSheetRef,
  useTabScrollables,
} from '@components/BottomSheet/BottomSheet';
import { List, TopTabBar } from '@components';
import {
  useAppSettings,
  useChapterGeneralSettings,
  useTheme,
} from '@hooks/persisted';
import SheetTabView from '@components/BottomSheet/SheetTabView';
import { getString } from '@i18n/translations';

import ReaderSheetPreferenceItem from './ReaderSheetPreferenceItem';
import TextSizeSlider from './TextSizeSlider';
import ReaderThemeSelector from './ReaderThemeSelector';
import ReaderTextAlignSelector from './ReaderTextAlignSelector';
import ReaderValueChange from './ReaderValueChange';
import ReaderFontPicker from './ReaderFontPicker';
import TTSTab from './TTSTab';
import { StringMap } from '@i18n/types';

type TabViewLabelProps = {
  route: {
    key: string;
    title: string;
  };
  labelText?: string;
  focused: boolean;
  color: string;
  allowFontScaling?: boolean;
  style?: StyleProp<TextStyle | null>;
};

interface TabProps {
  scrollRef: Ref<ScrollViewInstance>;
}

const ReaderTab = React.memo(({ scrollRef }: TabProps) => {
  return (
    <Suspense fallback={<></>}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.readerTab}>
        <TextSizeSlider />
        <ReaderThemeSelector />
        <ReaderTextAlignSelector />
        <ReaderValueChange
          label={getString('readerScreen.bottomSheet.lineHeight')}
          valueKey="lineHeight"
        />
        <ReaderValueChange
          label={getString('readerScreen.bottomSheet.padding')}
          valueKey="padding"
          valueChange={2}
          min={0}
          max={50}
          decimals={0}
          unit="px"
        />
        <ReaderFontPicker />
      </ScrollView>
    </Suspense>
  );
});

interface GeneralPreference {
  description?: string;
  key: string;
  label: string;
}

const displayPreferences: GeneralPreference[] = [
  {
    key: 'fullScreenMode',
    label: 'fullscreen',
    description: 'fullscreenDescription',
  },
  {
    key: 'showBatteryAndTime',
    label: 'showBatteryAndTime',
    description: 'showBatteryAndTimeDescription',
  },
  {
    key: 'showScrollPercentage',
    label: 'showProgressPercentage',
    description: 'showProgressPercentageDescription',
  },
  {
    key: 'verticalSeekbar',
    label: 'verticalSeekbar',
    description: 'verticalSeekbarDescription',
  },
  {
    key: 'removeExtraParagraphSpacing',
    label: 'removeExtraSpacing',
    description: 'removeExtraSpacingDescription',
  },
  {
    key: 'bionicReading',
    label: 'bionicReading',
    description: 'bionicReadingDescription',
  },
  { key: 'keepScreenOn', label: 'keepScreenOn' },
];

const navigationPreferences: GeneralPreference[] = [
  {
    key: 'autoScroll',
    label: 'autoscroll',
    description: 'autoscrollDescription',
  },
  {
    key: 'swipeGestures',
    label: 'swipeGestures',
    description: 'swipeGesturesDescription',
  },
  {
    key: 'useVolumeButtons',
    label: 'volumeButtonsScroll',
    description: 'volumeButtonsScrollDescription',
  },
  {
    key: 'pageReader',
    label: 'pageReader',
    description: 'pageReaderDescription',
  },
  {
    key: 'tapToScroll',
    label: 'tapToScroll',
    description: 'tapToScrollDescription',
  },
  {
    key: 'pageReaderDisableAnimation',
    label: 'disableReaderAnimations',
    description: 'disableReaderAnimationsDescription',
  },
];

const scrollModePreferences: GeneralPreference[] = [
  {
    key: 'infiniteScroll',
    label: 'infiniteScroll',
    description: 'infiniteScrollDescription',
  },
];

const pagedModePreferences: GeneralPreference[] = [
  {
    key: 'pageReaderInvertVolumeButtons',
    label: 'invertVolumeButtons',
    description: 'invertVolumeButtonsDescription',
  },
];

const GeneralTab = React.memo(({ scrollRef }: TabProps) => {
  const theme = useTheme();
  const { setChapterGeneralSettings, ...settings } =
    useChapterGeneralSettings();

  const toggleSetting = useCallback(
    (key: keyof typeof settings) =>
      setChapterGeneralSettings({ [key]: !settings[key] }),
    [setChapterGeneralSettings, settings],
  );

  const renderPreference = useCallback(
    (item: GeneralPreference) => (
      <ReaderSheetPreferenceItem
        key={item.key}
        description={
          item.description
            ? getString(
                `readerScreen.bottomSheet.${item.description}` as keyof StringMap,
              )
            : undefined
        }
        label={getString(
          `readerScreen.bottomSheet.${item.label}` as keyof StringMap,
        )}
        onPress={() => toggleSetting(item.key as keyof typeof settings)} // @ts-ignore
        value={settings[item.key]}
        theme={theme}
      />
    ),
    [settings, theme, toggleSetting],
  );

  // Two small fixed groups: virtualising them costs more to mount and measure
  // than simply drawing them, and this runs while the sheet is opening.
  return (
    <ScrollView ref={scrollRef}>
      <List.SubHeader theme={theme}>
        {getString('readerScreen.bottomSheet.display')}
      </List.SubHeader>
      {displayPreferences.map(renderPreference)}
      <List.SubHeader theme={theme}>
        {getString('readerScreen.bottomSheet.navigation')}
      </List.SubHeader>
      {navigationPreferences.map(item => {
        if (item.key === 'pageReader') {
          return (
            <React.Fragment key={item.key}>
              {renderPreference(item)}
              {(settings.pageReader
                ? pagedModePreferences
                : scrollModePreferences
              ).map(renderPreference)}
            </React.Fragment>
          );
        }
        return renderPreference(item);
      })}
    </ScrollView>
  );
});

interface ReaderBottomSheetV2Props {
  bottomSheetRef: RefObject<BottomSheetRef | null>;
}

const routes = [
  { key: 'readerTab', title: getString('readerSettings.title') },
  { key: 'generalTab', title: getString('generalSettings') },
  { key: 'ttsTab', title: 'TTS' },
];

const SNAP_POINTS = [360, 600];

const renderLazyPlaceholder = () => <View style={styles.flex} />;

const ReaderBottomSheetV2: React.FC<ReaderBottomSheetV2Props> = ({
  bottomSheetRef,
}) => {
  const theme = useTheme();
  const { reduceAppAnimations = false } = useAppSettings();
  const layout = useWindowDimensions();

  const tabHeaderColor = theme.surfaceContainerLow ?? theme.surface;

  const [index, setIndex] = useState(0);
  const { register, scrollableRef } = useTabScrollables(routes[index].key);

  const renderScene = useCallback(
    ({ route }: { route: { key: string } }) => {
      const scrollRef = register(route.key);
      switch (route.key) {
        case 'readerTab':
          return <ReaderTab scrollRef={scrollRef} />;
        case 'generalTab':
          return <GeneralTab scrollRef={scrollRef} />;
        default:
          return <TTSTab scrollRef={scrollRef} />;
      }
    },
    [register],
  );

  const renderTabBar = useCallback(
    (props: any) => (
      <TopTabBar
        {...props}
        indicatorStyle={{ backgroundColor: theme.primary }}
        style={[
          styles.tabBar,
          {
            backgroundColor: tabHeaderColor,
            borderBottomColor: theme.outlineVariant,
          },
        ]}
        inactiveColor={theme.onSurfaceVariant}
        activeColor={theme.primary}
        pressColor={Color(theme.primary).alpha(0.12).string()}
      />
    ),
    [theme, tabHeaderColor],
  );

  const renderLabel = useCallback(({ route, color }: TabViewLabelProps) => {
    return <Text style={{ color }}>{route.title}</Text>;
  }, []);

  return (
    <BottomSheet
      bottomSheetRef={bottomSheetRef}
      snapPoints={SNAP_POINTS}
      scrollableRef={scrollableRef}
    >
      <SheetTabView
        animationEnabled={!reduceAppAnimations}
        commonOptions={{
          label: renderLabel,
        }}
        navigationState={{ index, routes }}
        renderTabBar={renderTabBar}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={{ width: layout.width }}
        // Without this every tab is mounted at once – the TTS tab alone
        // enumerates the device's engines and voices over the bridge.
        lazy
        renderLazyPlaceholder={renderLazyPlaceholder}
      />
    </BottomSheet>
  );
};

export default React.memo(ReaderBottomSheetV2);

const styles = StyleSheet.create({
  readerTab: {
    gap: 4,
    paddingBottom: 20,
    paddingTop: 8,
  },
  tabBar: {
    borderBottomWidth: 0.5,
    elevation: 0,
  },
  flex: { flex: 1 },
});
