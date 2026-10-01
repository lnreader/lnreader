import React from 'react';

import { Dialog, RadioButton } from '@components';
import { ThemeColors } from '@theme/types';
import { getString } from '@i18n/translations';
import { useBrowseSettings } from '@hooks/persisted/index';

interface DisplayModeModalProps {
  globalSearchConcurrency: number;
  modalVisible: boolean;
  hideModal: () => void;
  theme: ThemeColors;
}

const ConcurrentSearchesModal: React.FC<DisplayModeModalProps> = ({
  theme,
  globalSearchConcurrency,
  hideModal,
  modalVisible,
}) => {
  const { setBrowseSettings } = useBrowseSettings();

  return (
    <Dialog.Root visible={modalVisible} onDismiss={hideModal}>
      <Dialog.Title>
        {getString('browseSettingsScreen.concurrentSearches')}
      </Dialog.Title>
      <Dialog.ScrollArea>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(concurrency => (
          <RadioButton
            key={concurrency}
            status={globalSearchConcurrency === concurrency}
            onPress={() =>
              setBrowseSettings({ globalSearchConcurrency: concurrency })
            }
            label={concurrency.toString()}
            theme={theme}
          />
        ))}
      </Dialog.ScrollArea>
    </Dialog.Root>
  );
};

export default ConcurrentSearchesModal;
