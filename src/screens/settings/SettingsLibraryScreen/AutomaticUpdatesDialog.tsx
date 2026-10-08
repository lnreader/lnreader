import { Dialog, RadioButton } from '@components';
import { getString } from '@i18n/translations';
import type { StringMap } from '@i18n/types';
import {
  AUTOMATIC_LIBRARY_UPDATE_INTERVALS,
  type AutomaticLibraryUpdateInterval,
} from '@services/backgroundTasks';
import { useTheme } from '@hooks/persisted';

type AutomaticUpdateLabel = Extract<
  keyof StringMap,
  `generalSettingsScreen.automaticUpdates${string}`
>;

const INTERVAL_LABELS: Record<
  AutomaticLibraryUpdateInterval,
  AutomaticUpdateLabel
> = {
  0: 'generalSettingsScreen.automaticUpdatesOff',
  12: 'generalSettingsScreen.automaticUpdatesEvery12Hours',
  24: 'generalSettingsScreen.automaticUpdatesDaily',
  48: 'generalSettingsScreen.automaticUpdatesEvery2Days',
  72: 'generalSettingsScreen.automaticUpdatesEvery3Days',
  168: 'generalSettingsScreen.automaticUpdatesWeekly',
};

interface AutomaticUpdatesDialogProps {
  intervalHours: AutomaticLibraryUpdateInterval;
  visible: boolean;
  onCancel: () => void;
  onSelect: (interval: AutomaticLibraryUpdateInterval) => void | Promise<void>;
}

const AutomaticUpdatesDialog = ({
  intervalHours,
  visible,
  onCancel,
  onSelect,
}: AutomaticUpdatesDialogProps) => {
  const theme = useTheme();
  return (
    <Dialog.Root visible={visible} onDismiss={onCancel}>
      <Dialog.Title>
        {getString('generalSettingsScreen.automaticUpdates')}
      </Dialog.Title>
      <Dialog.Description>
        {getString('generalSettingsScreen.automaticUpdatesDescription')}
      </Dialog.Description>
      <Dialog.ScrollArea>
        {AUTOMATIC_LIBRARY_UPDATE_INTERVALS.map(item => (
          <RadioButton
            key={item.toString()}
            label={getString(INTERVAL_LABELS[item])}
            status={item === intervalHours}
            onPress={() => onSelect(item)}
            theme={theme}
          />
        ))}
      </Dialog.ScrollArea>
      <Dialog.Actions>
        <Dialog.Action onPress={onCancel}>
          {getString('common.cancel')}
        </Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default AutomaticUpdatesDialog;
