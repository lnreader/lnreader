import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Dialog } from '@components';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';
import { MAX_INTERVAL } from '@services/updates/releaseSchedule';
import WheelPicker from './WheelPicker';

interface NextUpdateDialogProps {
  visible: boolean;
  onDismiss: () => void;
  /** Days until the predicted next update, or null when there is no prediction. */
  daysUntilUpdate: number | null;
  fetchInterval: number;
  /** Called with the chosen interval in days, or 0 for the predicted schedule. */
  onIntervalChange: (days: number) => void;
}

const intervalOptions = () => [
  getString('novelScreen.nextUpdate.default'),
  ...Array.from({ length: MAX_INTERVAL }, (_, i) => String(i + 1)),
];

const NextUpdateDialog = ({
  visible,
  onDismiss,
  daysUntilUpdate,
  fetchInterval,
  onIntervalChange,
}: NextUpdateDialogProps) => {
  const theme = useTheme();
  const initialInterval = fetchInterval < 0 ? -fetchInterval : 0;
  const [selectedInterval, setSelectedInterval] = useState(initialInterval);

  const confirm = () => {
    if (selectedInterval !== initialInterval) {
      onIntervalChange(selectedInterval);
    }
    onDismiss();
  };

  return (
    <Dialog.Root visible={visible} onDismiss={onDismiss}>
      <Dialog.Title>
        {getString('generalSettingsScreen.smartUpdate')}
      </Dialog.Title>
      <Dialog.Content>
        <Dialog.Description>
          {daysUntilUpdate !== null && fetchInterval !== 0
            ? getString('novelScreen.nextUpdate.expected', {
                nextUpdate: getString('time.days', { count: daysUntilUpdate }),
                interval: getString('time.days', {
                  count: Math.abs(fetchInterval),
                }),
              })
            : getString('novelScreen.nextUpdate.expectedNull')}
        </Dialog.Description>
        <Text style={[styles.pickerLabel, { color: theme.onSurfaceVariant }]}>
          {getString('novelScreen.nextUpdate.customInterval')}
        </Text>
        <WheelPicker
          items={intervalOptions()}
          selectedIndex={selectedInterval}
          onChange={setSelectedInterval}
          theme={theme}
        />
      </Dialog.Content>
      <Dialog.Actions>
        <Dialog.Action title={getString('common.cancel')} onPress={onDismiss} />
        <Dialog.Action title={getString('common.ok')} onPress={confirm} />
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default NextUpdateDialog;

const styles = StyleSheet.create({
  pickerLabel: {
    marginBottom: 8,
    marginTop: 16,
  },
});
