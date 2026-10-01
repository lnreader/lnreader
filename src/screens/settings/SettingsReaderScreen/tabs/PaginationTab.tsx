import React from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useChapterGeneralSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { List, SwitchItem } from '@components/index';
import ReaderPagedLayout from '@screens/reader/components/ReaderBottomSheet/ReaderPagedLayout';
import MenuBookIcon from '@expo/material-symbols/menu_book.xml';
import SwapVertIcon from '@expo/material-symbols/swap_vert.xml';
import AnimationIcon from '@expo/material-symbols/animation.xml';

const PaginationTab: React.FC = () => {
  const theme = useTheme();
  const {
    pageReader = false,
    pageReaderInvertVolumeButtons = false,
    pageReaderDisableAnimation = false,
    setChapterGeneralSettings,
  } = useChapterGeneralSettings();

  return (
    <Column modifiers={[fillMaxWidth()]}>
      <List.SubHeader theme={theme}>Reading Mode</List.SubHeader>
      <SwitchItem
        label={getString('readerScreen.bottomSheet.pageReader')}
        icon={MenuBookIcon}
        description={getString(
          'readerScreen.bottomSheet.pageReaderDescription',
        )}
        value={pageReader}
        onPress={() => setChapterGeneralSettings({ pageReader: !pageReader })}
        theme={theme}
      />
      {pageReader && (
        <>
          <SwitchItem
            label={getString('readerScreen.bottomSheet.invertVolumeButtons')}
            icon={SwapVertIcon}
            description={getString(
              'readerScreen.bottomSheet.invertVolumeButtonsDescription',
            )}
            value={pageReaderInvertVolumeButtons}
            onPress={() =>
              setChapterGeneralSettings({
                pageReaderInvertVolumeButtons: !pageReaderInvertVolumeButtons,
              })
            }
            theme={theme}
          />
          <SwitchItem
            label={getString('readerScreen.bottomSheet.disablePageTransitions')}
            icon={AnimationIcon}
            description={getString(
              'readerScreen.bottomSheet.disablePageTransitionsDescription',
            )}
            value={pageReaderDisableAnimation}
            onPress={() =>
              setChapterGeneralSettings({
                pageReaderDisableAnimation: !pageReaderDisableAnimation,
              })
            }
            theme={theme}
          />
          <ReaderPagedLayout />
        </>
      )}
    </Column>
  );
};

export default PaginationTab;
