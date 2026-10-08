import React from 'react';
import { Column } from '@expo/ui/jetpack-compose';
import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { useTheme, useChapterReaderSettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { List, ColorPreferenceItem, Button } from '@components/index';
import { useBoolean } from '@hooks';
import ColorPickerModal from '@components/ColorPickerModal/ColorPickerModal';
import ReaderThemeSelector from '@screens/reader/components/ReaderBottomSheet/ReaderThemeSelector';
import { presetReaderThemes } from '@utils/constants/readerConstants';
import FormatPaintIcon from '@expo/material-symbols/format_paint.xml';
import TextFormatIcon from '@expo/material-symbols/text_format.xml';

const ThemeTab: React.FC = () => {
  const theme = useTheme();
  const readerSettings = useChapterReaderSettings();
  const readerBackgroundModal = useBoolean();
  const readerTextColorModal = useBoolean();

  const isCurrentThemeCustom = readerSettings.customThemes.some(
    item =>
      item.backgroundColor === readerSettings.theme &&
      item.textColor === readerSettings.textColor,
  );

  const isCurrentThemePreset = presetReaderThemes.some(
    item =>
      item.backgroundColor === readerSettings.theme &&
      item.textColor === readerSettings.textColor,
  );

  return (
    <>
      <Column modifiers={[fillMaxWidth()]}>
        <Column modifiers={[fillMaxWidth()]}>
          <List.SubHeader theme={theme}>
            {getString('readerSettings.preset')}
          </List.SubHeader>
          <ReaderThemeSelector label={getString('readerSettings.preset')} />
        </Column>

        <Column modifiers={[fillMaxWidth()]}>
          <List.SubHeader theme={theme}>Custom Colors</List.SubHeader>
          <ColorPreferenceItem
            label={getString('readerSettings.backgroundColor')}
            icon={FormatPaintIcon}
            description={readerSettings.theme}
            onPress={readerBackgroundModal.setTrue}
            theme={theme}
          />
          <ColorPreferenceItem
            label={getString('readerSettings.textColor')}
            icon={TextFormatIcon}
            description={readerSettings.textColor}
            onPress={readerTextColorModal.setTrue}
            theme={theme}
          />
        </Column>

        {isCurrentThemeCustom ? (
          <Column modifiers={[fillMaxWidth()]}>
            <Button
              title={getString('readerSettings.deleteCustomTheme')}
              onPress={() =>
                readerSettings.deleteCustomReaderTheme({
                  backgroundColor: readerSettings.theme,
                  textColor: readerSettings.textColor,
                })
              }
            />
          </Column>
        ) : !isCurrentThemePreset ? (
          <Column modifiers={[fillMaxWidth()]}>
            <Button
              title={getString('readerSettings.saveCustomTheme')}
              onPress={() =>
                readerSettings.saveCustomReaderTheme({
                  backgroundColor: readerSettings.theme,
                  textColor: readerSettings.textColor,
                })
              }
            />
          </Column>
        ) : null}
      </Column>
      <ColorPickerModal
        title={getString('readerSettings.backgroundColor')}
        visible={readerBackgroundModal.value}
        color={readerSettings.theme}
        closeModal={readerBackgroundModal.setFalse}
        theme={theme}
        onSubmit={color =>
          readerSettings.setChapterReaderSettings({ theme: color })
        }
      />
      <ColorPickerModal
        title={getString('readerSettings.textColor')}
        visible={readerTextColorModal.value}
        color={readerSettings.textColor}
        closeModal={readerTextColorModal.setFalse}
        theme={theme}
        onSubmit={color =>
          readerSettings.setChapterReaderSettings({ textColor: color })
        }
      />
    </>
  );
};

export default ThemeTab;
