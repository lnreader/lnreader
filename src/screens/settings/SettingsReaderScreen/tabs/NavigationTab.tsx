import React, { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { Column, Row } from '@expo/ui/jetpack-compose';
import {
  fillMaxWidth,
  padding,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import defaultTo from 'lodash-es/defaultTo';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import {
  AppText,
  List,
  Slider,
  SwitchItem,
  TextInput,
} from '@components/index';
import VolumeUpIcon from '@expo/material-symbols/volume_up.xml';
import HeightIcon from '@expo/material-symbols/height.xml';
import SwipeLeftIcon from '@expo/material-symbols/swipe_left.xml';
import TouchAppIcon from '@expo/material-symbols/touch_app.xml';
import AllInclusiveIcon from '@expo/material-symbols/all_inclusive.xml';
import AutoplayIcon from '@expo/material-symbols/autoplay.xml';
import MotionBlurIcon from '@expo/material-symbols/motion_blur.xml';
import {
  MAX_AUTO_SCROLL_INTERVAL,
  MIN_AUTO_SCROLL_INTERVAL,
} from '@utils/constants/readerConstants';

const AUTO_SCROLL_INTERVAL_STEP = 5;

const NavigationTab: React.FC = () => {
  const theme = useTheme();
  const {
    useVolumeButtons = false,
    volumeButtonsOffset = null,
    verticalSeekbar = true,
    swipeGestures = false,
    autoScroll = false,
    autoScrollInterval = 10,
    autoScrollSmooth = false,
    tapToScroll = false,
    continuousChapters = true,
    pageReader = false,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  const { height: screenHeight } = useWindowDimensions();

  const [intervalDrag, setIntervalDrag] = useState<number>();
  const interval = Math.min(
    MAX_AUTO_SCROLL_INTERVAL,
    Math.max(MIN_AUTO_SCROLL_INTERVAL, autoScrollInterval),
  );

  return (
    <Column modifiers={[fillMaxWidth()]}>
      <Column modifiers={[fillMaxWidth()]}>
        <List.SubHeader theme={theme}>Navigation Controls</List.SubHeader>
        {/* Pages turn by taps and the volume keys; scrolling-only options are off. */}
        <SwitchItem
          label={getString(
            pageReader
              ? 'readerScreen.bottomSheet.volumeButtonsTurnPages'
              : 'readerScreen.bottomSheet.volumeButtonsScroll',
          )}
          icon={VolumeUpIcon}
          description={getString(
            pageReader
              ? 'readerScreen.bottomSheet.volumeButtonsTurnPagesDescription'
              : 'readerScreen.bottomSheet.volumeButtonsScrollDescription',
          )}
          value={useVolumeButtons}
          onPress={() =>
            setChapterGeneralSettings({ useVolumeButtons: !useVolumeButtons })
          }
          theme={theme}
        />
        {useVolumeButtons && !pageReader && (
          <Column modifiers={[fillMaxWidth(), padding(16, 4, 16, 8)]}>
            <TextInput
              label={getString('readerSettings.volumeButtonOffset')}
              keyboardType="number"
              value={defaultTo(
                volumeButtonsOffset
                  ? Math.round(volumeButtonsOffset / screenHeight)
                  : null,
                0.75,
              ).toString()}
              onChangeText={text => {
                if (!isNaN(Number(text))) {
                  setChapterGeneralSettings({
                    volumeButtonsOffset: Math.round(
                      Number(text) * screenHeight,
                    ),
                  });
                }
              }}
            />
          </Column>
        )}
        <SwitchItem
          label={getString('readerScreen.bottomSheet.verticalSeekbar')}
          icon={HeightIcon}
          description={getString(
            'readerScreen.bottomSheet.verticalSeekbarDescription',
          )}
          value={verticalSeekbar}
          onPress={() =>
            setChapterGeneralSettings({ verticalSeekbar: !verticalSeekbar })
          }
          theme={theme}
        />
        <SwitchItem
          label={getString('readerScreen.bottomSheet.swipeGestures')}
          icon={SwipeLeftIcon}
          description={getString(
            pageReader
              ? 'readerSettings.disabledInPagedMode'
              : 'readerScreen.bottomSheet.swipeGesturesDescription',
          )}
          value={swipeGestures}
          disabled={pageReader}
          onPress={() =>
            setChapterGeneralSettings({ swipeGestures: !swipeGestures })
          }
          theme={theme}
        />
        <SwitchItem
          label={getString(
            pageReader
              ? 'readerScreen.bottomSheet.tapToTurnPages'
              : 'readerScreen.bottomSheet.tapToScroll',
          )}
          icon={TouchAppIcon}
          description={getString(
            pageReader
              ? 'readerScreen.bottomSheet.tapToTurnPagesDescription'
              : 'readerScreen.bottomSheet.tapToScrollDescription',
          )}
          value={tapToScroll}
          onPress={() =>
            setChapterGeneralSettings({ tapToScroll: !tapToScroll })
          }
          theme={theme}
        />
        <SwitchItem
          label={getString('readerSettings.continuousChapters')}
          icon={AllInclusiveIcon}
          description={getString(
            pageReader
              ? 'readerSettings.disabledInPagedMode'
              : 'readerSettings.continuousChaptersDesc',
          )}
          value={continuousChapters}
          disabled={pageReader}
          onPress={() =>
            setChapterGeneralSettings({
              continuousChapters: !continuousChapters,
            })
          }
          theme={theme}
        />
      </Column>

      <Column modifiers={[fillMaxWidth()]}>
        <List.SubHeader theme={theme}>
          {getString('readerScreen.bottomSheet.autoscroll')}
        </List.SubHeader>
        <SwitchItem
          label={getString('readerScreen.bottomSheet.autoscroll')}
          icon={AutoplayIcon}
          description={getString(
            pageReader
              ? 'readerSettings.disabledInPagedMode'
              : 'readerScreen.bottomSheet.autoscrollDescription',
          )}
          value={autoScroll}
          disabled={pageReader}
          onPress={() => setChapterGeneralSettings({ autoScroll: !autoScroll })}
          theme={theme}
        />
        <SwitchItem
          label={getString('readerSettings.autoScrollSmooth')}
          icon={MotionBlurIcon}
          description={getString('readerSettings.autoScrollSmoothDesc')}
          value={autoScrollSmooth}
          disabled={!autoScroll || pageReader}
          onPress={() =>
            setChapterGeneralSettings({ autoScrollSmooth: !autoScrollSmooth })
          }
          theme={theme}
        />
        <Column modifiers={[fillMaxWidth(), padding(16, 8, 16, 8)]}>
          <Row verticalAlignment="center" modifiers={[fillMaxWidth()]}>
            <AppText
              variant="bodyMedium"
              color={theme.onSurfaceVariant}
              modifiers={[weight(1)]}
            >
              {getString('readerSettings.autoScrollInterval')}
            </AppText>
            <AppText variant="labelLarge">
              {`${intervalDrag ?? interval}s`}
            </AppText>
          </Row>
          <Slider
            value={interval}
            min={MIN_AUTO_SCROLL_INTERVAL}
            max={MAX_AUTO_SCROLL_INTERVAL}
            step={AUTO_SCROLL_INTERVAL_STEP}
            disabled={!autoScroll || pageReader}
            onValueChange={value => setIntervalDrag(Math.round(value))}
            onSlidingComplete={value => {
              setIntervalDrag(undefined);
              setChapterGeneralSettings({
                autoScrollInterval: Math.round(value),
              });
            }}
          />
        </Column>
      </Column>
    </Column>
  );
};

export default NavigationTab;
