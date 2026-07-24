import React from 'react';

import { Dialog, RadioButton } from '@components';

import { ThemeColors } from '@theme/types';
import { useLibrarySettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';

interface GridSizeModalProps {
  novelsPerRow: number;
  gridSizeModalVisible: boolean;
  hideGridSizeModal: () => void;
  theme: ThemeColors;
}

const GridSizeModal: React.FC<GridSizeModalProps> = ({
  novelsPerRow,
  gridSizeModalVisible,
  hideGridSizeModal,
  theme,
}) => {
  const { setLibrarySettings } = useLibrarySettings();

  const gridSizes = {
    5: 'XS',
    4: 'S',
    3: 'M',
    2: 'L',
    1: 'XL',
  };

  return (
    <Dialog.Root visible={gridSizeModalVisible} onDismiss={hideGridSizeModal}>
      <Dialog.Header>
        <Dialog.Title>
          {getString('generalSettingsScreen.gridSize')}
        </Dialog.Title>
        <Dialog.Description>
          {getString('generalSettingsScreen.gridSizeDesc', {
            num: novelsPerRow,
          })}
        </Dialog.Description>
      </Dialog.Header>
      <Dialog.List>
        {Object.keys(gridSizes).map(item => {
          const it = Number(item);
          return (
            <RadioButton
              key={item}
              status={it === novelsPerRow}
              // @ts-ignore
              label={gridSizes[it]}
              onPress={() => setLibrarySettings({ novelsPerRow: it })}
              theme={theme}
            />
          );
        })}
      </Dialog.List>
    </Dialog.Root>
  );
};

export default GridSizeModal;
