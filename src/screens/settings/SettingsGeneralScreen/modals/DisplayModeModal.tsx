import {
  DisplayModes,
  displayModesList,
} from '@screens/library/constants/constants';
import React from 'react';

import { Dialog, RadioButton } from '@components';
import { ThemeColors } from '@theme/types';
import { useLibrarySettings } from '@hooks/persisted';
import { getString } from '@i18n/translations';

interface DisplayModeModalProps {
  displayMode: DisplayModes;
  displayModalVisible: boolean;
  hideDisplayModal: () => void;
  theme: ThemeColors;
}

const DisplayModeModal: React.FC<DisplayModeModalProps> = ({
  theme,
  displayMode,
  hideDisplayModal,
  displayModalVisible,
}) => {
  const { setLibrarySettings } = useLibrarySettings();

  return (
    <Dialog.Root visible={displayModalVisible} onDismiss={hideDisplayModal}>
      <Dialog.Title>
        {getString('generalSettingsScreen.displayMode')}
      </Dialog.Title>
      <Dialog.List>
        {displayModesList.map(mode => (
          <RadioButton
            key={mode.value}
            status={displayMode === mode.value}
            onPress={() => setLibrarySettings({ displayMode: mode.value })}
            label={mode.label}
            theme={theme}
          />
        ))}
      </Dialog.List>
    </Dialog.Root>
  );
};

export default DisplayModeModal;
