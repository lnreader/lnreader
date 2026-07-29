import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  useWindowDimensions,
  View,
} from 'react-native';
import React, {
  RefObject,
  useMemo,
  useState,
  useCallback,
  Suspense,
} from 'react';
import Color from 'color';

import { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { List, TopTabBar } from '@components';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { SceneMap, TabView } from 'react-native-tab-view';
import { getString } from '@i18n/translations';

import ReaderSheetPreferenceItem from './ReaderSheetPreferenceItem';
import TextSizeSlider from './TextSizeSlider';
import ReaderThemeSelector from './ReaderThemeSelector';
import ReaderTextAlignSelector from './ReaderTextAlignSelector';
import ReaderValueChange from './ReaderValueChange';
import ReaderFontPicker from './ReaderFontPicker';
import TTSTab from './TTSTab';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
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

const ReaderTab: React.FC = React.memo(() => {
  return (
    <Suspense fallback={<></>}>
      <BottomSheetScrollView contentContainerStyle={styles.readerTab}>
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
      </BottomSheetScrollView>
    </Suspense>
  );
});

interface GeneralPreference {
  description?: string;
  key: string;
  label: string;
  /** Turned off when this one is turned on, for mutually exclusive modes. */
  exclusiveWith?: string;
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
    exclusiveWith: 'continuousReading',
  },
  {
    key: 'continuousReading',
    label: 'continuousReading',
    description: 'continuousReadingDescription',
    exclusiveWith: 'pageReader',
  },
  {
    key: 'tapToScroll',
    label: 'tapToScroll',
    description: 'tapToScrollDescription',
  },
];

const GeneralTab: React.FC = React.memo(() => {
  const theme = useTheme();
  const { setChapterGeneralSettings, ...settings } =
    useChapterGeneralSettings();

  const toggleSetting = useCallback(
    (key: keyof typeof settings, exclusiveWith?: string) => {
      const enabling = !settings[key];
      setChapterGeneralSettings({
        [key]: enabling,
        ...(enabling && exclusiveWith ? { [exclusiveWith]: false } : {}),
      });
    },
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
        onPress={() =>
          toggleSetting(item.key as keyof typeof settings, item.exclusiveWith)
        } // @ts-ignore
        value={settings[item.key]}
        theme={theme}
      />
    ),
    [settings, theme, toggleSetting],
  );

  // Two small fixed groups: virtualising them costs more to mount and measure
  // than simply drawing them, and this runs while the sheet is opening.
  return (
    <BottomSheetScrollView>
      <List.SubHeader theme={theme}>
        {getString('readerScreen.bottomSheet.display')}
      </List.SubHeader>
      {displayPreferences.map(renderPreference)}
      <List.SubHeader theme={theme}>
        {getString('readerScreen.bottomSheet.navigation')}
      </List.SubHeader>
      {navigationPreferences.map(renderPreference)}
    </BottomSheetScrollView>
  );
});

interface ReaderBottomSheetV2Props {
  bottomSheetRef: RefObject<BottomSheetModalMethods | null>;
}

const routes = [
  { key: 'readerTab', title: getString('readerSettings.title') },
  { key: 'generalTab', title: getString('generalSettings') },
  { key: 'ttsTab', title: 'TTS' },
];

const renderLazyPlaceholder = () => <View style={styles.flex} />;

const ReaderBottomSheetV2: React.FC<ReaderBottomSheetV2Props> = ({
  bottomSheetRef,
}) => {
  const theme = useTheme();
  const layout = useWindowDimensions();

  const tabHeaderColor = theme.surfaceContainerLow ?? theme.surface;

  const renderScene = useMemo(
    () =>
      SceneMap({
        readerTab: ReaderTab,
        generalTab: GeneralTab,
        ttsTab: TTSTab,
      }),
    [],
  );

  const [index, setIndex] = useState(0);

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
    <BottomSheet bottomSheetRef={bottomSheetRef} snapPoints={[360, 600]}>
      <BottomSheetView style={styles.flex}>
        <TabView
          commonOptions={{
            label: renderLabel,
          }}
          navigationState={{ index, routes }}
          renderTabBar={renderTabBar}
          renderScene={renderScene}
          onIndexChange={setIndex}
          initialLayout={{ width: layout.width }}
          style={styles.tabView}
          // Without this every tab is mounted at once – the TTS tab alone
          // enumerates the device's engines and voices over the bridge.
          lazy
          renderLazyPlaceholder={renderLazyPlaceholder}
        />
      </BottomSheetView>
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
  tabView: {
    height: 600,
  },
  flex: { flex: 1 },
});
