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

import { BottomSheetFlashList, BottomSheetView } from '@gorhom/bottom-sheet';
import BottomSheet from '@components/BottomSheet/BottomSheet';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { SceneMap, TabBar, TabView } from 'react-native-tab-view';
import { getString } from '@strings/translations';

import ReaderSheetPreferenceItem from './ReaderSheetPreferenceItem';
import TextSizeSlider from './TextSizeSlider';
import ReaderThemeSelector from './ReaderThemeSelector';
import ReaderTextAlignSelector from './ReaderTextAlignSelector';
import ReaderValueChange from './ReaderValueChange';
import ReaderFontPicker from './ReaderFontPicker';
import TTSTab from './TTSTab';
import { overlay } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModalMethods } from '@gorhom/bottom-sheet/lib/typescript/types';
import { StringMap } from '@strings/types';

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

const ReaderTab: React.FC = React.memo(() => (
  <Suspense fallback={<></>}>
    <View style={styles.readerTab}>
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
    </View>
  </Suspense>
));

const GeneralTab: React.FC = React.memo(() => {
  const theme = useTheme();
  const { setChapterGeneralSettings, ...settings } =
    useChapterGeneralSettings();

  const toggleSetting = useCallback(
    (key: keyof typeof settings) =>
      setChapterGeneralSettings({ [key]: !settings[key] }),
    [setChapterGeneralSettings, settings],
  );

  const preferences = useMemo(
    () => [
      { key: 'fullScreenMode', label: 'fullscreen' },
      { key: 'autoScroll', label: 'autoscroll' },
      { key: 'verticalSeekbar', label: 'verticalSeekbar' },
      { key: 'showBatteryAndTime', label: 'showBatteryAndTime' },
      { key: 'showScrollPercentage', label: 'showProgressPercentage' },
      { key: 'swipeGestures', label: 'swipeGestures' },
      { key: 'pageReader', label: 'pageReader' },
      { key: 'removeExtraParagraphSpacing', label: 'removeExtraSpacing' },
      { key: 'useVolumeButtons', label: 'volumeButtonsScroll' },
      { key: 'bionicReading', label: 'bionicReading' },
      { key: 'tapToScroll', label: 'tapToScroll' },
      { key: 'keepScreenOn', label: 'keepScreenOn' },
    ],
    [],
  );

  const renderItem = useCallback(
    ({ item }: { item: { key: string; label: string } }) => (
      <ReaderSheetPreferenceItem
        key={item.key}
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

  return (
    <BottomSheetFlashList
      data={preferences}
      extraData={[settings]}
      keyExtractor={(item: { key: string; label: string }) => item.key}
      renderItem={renderItem}
      estimatedItemSize={60}
    />
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

const ReaderBottomSheetV2: React.FC<ReaderBottomSheetV2Props> = ({
  bottomSheetRef,
}) => {
  const theme = useTheme();
  const { bottom, left, right } = useSafeAreaInsets();
  const layout = useWindowDimensions();

  const tabHeaderColor = overlay(2, theme.surface);
  const backgroundColor = tabHeaderColor;

  const renderScene = useMemo(
    () => SceneMap({ readerTab: ReaderTab, generalTab: GeneralTab, ttsTab: TTSTab }),
    [],
  );

  const [index, setIndex] = useState(0);

  const renderTabBar = useCallback(
    (props: any) => (
      <TabBar
        {...props}
        indicatorStyle={{ backgroundColor: theme.primary }}
        style={[styles.tabBar, { backgroundColor: tabHeaderColor }]}
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
      snapPoints={[360, 600]}
      backgroundStyle={{ backgroundColor }}
      bottomInset={bottom}
      containerStyle={[
        styles.container,
        { marginLeft: left, marginRight: right },
      ]}
    >
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
        />
      </BottomSheetView>
    </BottomSheet>
  );
};

export default React.memo(ReaderBottomSheetV2);

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
  },
  readerTab: {
    paddingVertical: 8,
  },
  tabBar: {
    borderBottomWidth: 0.5,
    elevation: 0,
  },
  tabView: {
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    height: 600,
  },
  flex: { flex: 1 },
});
