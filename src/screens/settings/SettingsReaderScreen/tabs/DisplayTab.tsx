import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useChapterReaderSettings, useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import ReaderTextSize from '../ReaderTextSize';
import ReaderValueChange from '@screens/reader/components/ReaderBottomSheet/ReaderValueChange';
import ReaderTextAlignSelector from '@screens/reader/components/ReaderBottomSheet/ReaderTextAlignSelector';
import ReaderThemeSelector from '@screens/reader/components/ReaderBottomSheet/ReaderThemeSelector';
import ReaderFontPicker from '@screens/reader/components/ReaderBottomSheet/ReaderFontPicker';
import { List, SwitchItem } from '@components/index';
import { useBoolean } from '@hooks';
import FontPickerModal from '../Modals/FontPickerModal';
import { readerFonts } from '@utils/constants/readerConstants';
import FontDownloadIcon from '@expo/material-symbols/font_download.xml';
import TitleIcon from '@expo/material-symbols/title.xml';

/**
 * The reader's sheet has no Theme tab or font dialog: like upstream's sheet it
 * shows the preset themes and the fonts inline.
 */
const DisplayTab = ({ inReaderSheet = false }: { inReaderSheet?: boolean }) => {
  const theme = useTheme();
  const readerSettings = useChapterReaderSettings();
  const readerFontPickerModal = useBoolean();

  const currentFontName = readerFonts.find(
    item => item.fontFamily === readerSettings.fontFamily,
  )?.name;

  return (
    <>
      <Column modifiers={[fillMaxWidth()]}>
        <Column modifiers={[fillMaxWidth()]}>
          <ReaderTextSize />
          {inReaderSheet ? <ReaderThemeSelector /> : null}
          <ReaderTextAlignSelector />
          {inReaderSheet ? (
            <ReaderFontPicker />
          ) : (
            <List.Item
              title={getString('readerScreen.bottomSheet.fontStyle')}
              icon={FontDownloadIcon}
              description={currentFontName}
              onPress={readerFontPickerModal.setTrue}
              theme={theme}
            />
          )}
          <SwitchItem
            label={getString('readerSettings.chapterTitles')}
            icon={TitleIcon}
            description={getString('readerSettings.chapterTitlesDesc')}
            value={readerSettings.showChapterTitle ?? false}
            onPress={() =>
              readerSettings.setChapterReaderSettings({
                showChapterTitle: !readerSettings.showChapterTitle,
              })
            }
            theme={theme}
          />
          <ReaderValueChange
            label={getString('readerSettings.textIndent')}
            valueKey="textIndent"
            valueChange={0.5}
            min={0}
            max={4}
            unit="em"
          />
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
          <ReaderValueChange
            label={getString('readerSettings.paragraphSpacing')}
            valueKey="paragraphSpacing"
            valueChange={0.25}
            min={0}
            max={3}
            decimals={2}
            unit="em"
          />
        </Column>
      </Column>
      <FontPickerModal
        currentFont={readerSettings.fontFamily}
        visible={readerFontPickerModal.value}
        onDismiss={readerFontPickerModal.setFalse}
      />
    </>
  );
};

export default DisplayTab;
