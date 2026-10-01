import React from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { List, SwitchItem } from '@components/index';
import FullscreenIcon from '@expo/material-symbols/fullscreen.xml';
import PercentIcon from '@expo/material-symbols/percent.xml';
import BatteryFullIcon from '@expo/material-symbols/battery_full.xml';
import LightModeIcon from '@expo/material-symbols/light_mode.xml';
import FormatBoldIcon from '@expo/material-symbols/format_bold.xml';
import CompressIcon from '@expo/material-symbols/compress.xml';

const AccessibilityTab: React.FC = () => {
  const theme = useTheme();
  const {
    fullScreenMode = true,
    showScrollPercentage = true,
    showBatteryAndTime = false,
    keepScreenOn = true,
    bionicReading = false,
    removeExtraParagraphSpacing = false,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  return (
    <Column modifiers={[fillMaxWidth()]}>
      <Column modifiers={[fillMaxWidth()]}>
        <List.SubHeader theme={theme}>
          {getString('common.display')}
        </List.SubHeader>
        <SwitchItem
          label={getString('readerScreen.bottomSheet.fullscreen')}
          icon={FullscreenIcon}
          description={getString(
            'readerScreen.bottomSheet.fullscreenDescription',
          )}
          value={fullScreenMode}
          onPress={() =>
            setChapterGeneralSettings({ fullScreenMode: !fullScreenMode })
          }
          theme={theme}
        />
        <SwitchItem
          label={getString('readerScreen.bottomSheet.showProgressPercentage')}
          icon={PercentIcon}
          description={getString(
            'readerScreen.bottomSheet.showProgressPercentageDescription',
          )}
          value={showScrollPercentage}
          onPress={() =>
            setChapterGeneralSettings({
              showScrollPercentage: !showScrollPercentage,
            })
          }
          theme={theme}
        />
        <SwitchItem
          label={getString('readerScreen.bottomSheet.showBatteryAndTime')}
          icon={BatteryFullIcon}
          description={getString(
            'readerScreen.bottomSheet.showBatteryAndTimeDescription',
          )}
          value={showBatteryAndTime}
          onPress={() =>
            setChapterGeneralSettings({
              showBatteryAndTime: !showBatteryAndTime,
            })
          }
          theme={theme}
        />
        <SwitchItem
          label={getString('readerScreen.bottomSheet.keepScreenOn')}
          icon={LightModeIcon}
          value={keepScreenOn}
          onPress={() =>
            setChapterGeneralSettings({ keepScreenOn: !keepScreenOn })
          }
          theme={theme}
        />
      </Column>

      <Column modifiers={[fillMaxWidth()]}>
        <List.SubHeader theme={theme}>Reading Enhancements</List.SubHeader>
        <SwitchItem
          label={getString('readerScreen.bottomSheet.bionicReading')}
          icon={FormatBoldIcon}
          description={getString(
            'readerScreen.bottomSheet.bionicReadingDescription',
          )}
          value={bionicReading}
          onPress={() =>
            setChapterGeneralSettings({ bionicReading: !bionicReading })
          }
          theme={theme}
        />
        <SwitchItem
          label={getString('readerScreen.bottomSheet.removeExtraSpacing')}
          icon={CompressIcon}
          description={getString(
            'readerScreen.bottomSheet.removeExtraSpacingDescription',
          )}
          value={removeExtraParagraphSpacing}
          onPress={() =>
            setChapterGeneralSettings({
              removeExtraParagraphSpacing: !removeExtraParagraphSpacing,
            })
          }
          theme={theme}
        />
      </Column>
    </Column>
  );
};

export default AccessibilityTab;
