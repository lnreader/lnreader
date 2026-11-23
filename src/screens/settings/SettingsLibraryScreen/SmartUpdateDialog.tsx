import { Checkbox, Dialog } from '@components';
import type { SmartUpdateFilters } from '@hooks/persisted/useSettings';
import { useTheme } from '@hooks/persisted';
import { getString } from '@i18n/translations';

export interface SmartUpdateDialogFilters extends SmartUpdateFilters {
  skipNotDue: boolean;
}

interface SmartUpdateDialogProps {
  filters: SmartUpdateDialogFilters;
  visible: boolean;
  onCancel: () => void;
  onChange: (filters: SmartUpdateDialogFilters) => void;
  onSave: () => void;
}

const SmartUpdateDialog = ({
  filters,
  visible,
  onCancel,
  onChange,
  onSave,
}: SmartUpdateDialogProps) => {
  const theme = useTheme();

  return (
    <Dialog.Root visible={visible} onDismiss={onCancel}>
      <Dialog.Title>
        {getString('generalSettingsScreen.smartUpdate')}
      </Dialog.Title>
      <Dialog.List>
        <Checkbox
          label={getString('generalSettingsScreen.smartUpdateSkipWithUnread')}
          status={filters.skipWithUnread}
          onPress={() =>
            onChange({
              ...filters,
              skipWithUnread: !filters.skipWithUnread,
            })
          }
          theme={theme}
        />
        <Checkbox
          label={getString('generalSettingsScreen.smartUpdateSkipUnstarted')}
          status={filters.skipUnstarted}
          onPress={() =>
            onChange({
              ...filters,
              skipUnstarted: !filters.skipUnstarted,
            })
          }
          theme={theme}
        />
        <Checkbox
          label={getString('generalSettingsScreen.smartUpdateSkipCompleted')}
          status={filters.skipCompleted}
          onPress={() =>
            onChange({
              ...filters,
              skipCompleted: !filters.skipCompleted,
            })
          }
          theme={theme}
        />
        <Checkbox
          label={getString('generalSettingsScreen.smartUpdateSkipNotDue')}
          status={filters.skipNotDue}
          onPress={() =>
            onChange({
              ...filters,
              skipNotDue: !filters.skipNotDue,
            })
          }
          theme={theme}
        />
      </Dialog.List>
      <Dialog.Actions>
        <Dialog.Action onPress={onCancel}>
          {getString('common.cancel')}
        </Dialog.Action>
        <Dialog.Action onPress={onSave}>{getString('common.ok')}</Dialog.Action>
      </Dialog.Actions>
    </Dialog.Root>
  );
};

export default SmartUpdateDialog;
