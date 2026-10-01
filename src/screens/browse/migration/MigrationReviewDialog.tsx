import { fillMaxWidth } from '@expo/ui/jetpack-compose/modifiers';
import { Column } from '@expo/ui/jetpack-compose';

import { AppText, Checkbox, Dialog, RadioButton } from '@components';
import { getString } from '@i18n/translations';
import type { MigrationNovelOptions } from '@services/backgroundTasks';
import type { ThemeColors } from '@theme/types';

interface MigrationReviewDialogProps {
  destinationName: string;
  options: MigrationNovelOptions;
  theme: ThemeColors;
  visible: boolean;
  onCancel: () => void;
  onChange: (options: MigrationNovelOptions) => void;
  onMigrate: () => void;
}

const MigrationReviewDialog = ({
  destinationName,
  options,
  theme,
  visible,
  onCancel,
  onChange,
  onMigrate,
}: MigrationReviewDialogProps) => (
  <Dialog.Root visible={visible} onDismiss={onCancel}>
    <Dialog.Header>
      <Dialog.Title>
        {getString('browseScreen.migration.reviewTitle')}
      </Dialog.Title>
      <Dialog.Description>
        {getString('browseScreen.migration.reviewDescription', {
          name: destinationName,
        })}
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Content>
      <Column modifiers={[fillMaxWidth()]}>
        <AppText variant="titleSmall" color={theme.onSurface}>
          {getString('browseScreen.migration.cover')}
        </AppText>
        <RadioButton
          label={getString('browseScreen.migration.useDestination')}
          status={options.cover === 'destination'}
          onPress={() => onChange({ ...options, cover: 'destination' })}
          theme={theme}
        />
        <RadioButton
          label={getString('browseScreen.migration.keepCurrent')}
          status={options.cover === 'current'}
          onPress={() => onChange({ ...options, cover: 'current' })}
          theme={theme}
        />
      </Column>
      <Column modifiers={[fillMaxWidth()]}>
        <AppText variant="titleSmall" color={theme.onSurface}>
          {getString('browseScreen.migration.metadata')}
        </AppText>
        <RadioButton
          label={getString('browseScreen.migration.useDestination')}
          status={options.metadata === 'destination'}
          onPress={() => onChange({ ...options, metadata: 'destination' })}
          theme={theme}
        />
        <RadioButton
          label={getString('browseScreen.migration.keepCurrent')}
          status={options.metadata === 'current'}
          onPress={() => onChange({ ...options, metadata: 'current' })}
          theme={theme}
        />
      </Column>
      <Checkbox
        label={getString('browseScreen.migration.redownloadChapters')}
        status={options.redownloadChapters}
        onPress={() =>
          onChange({
            ...options,
            redownloadChapters: !options.redownloadChapters,
          })
        }
        theme={theme}
      />
      <Dialog.Description>
        {getString('browseScreen.migration.preservedState')}
      </Dialog.Description>
    </Dialog.Content>
    <Dialog.Actions>
      <Dialog.Action onPress={onCancel}>
        {getString('common.cancel')}
      </Dialog.Action>
      <Dialog.Action onPress={onMigrate}>
        {getString('novelScreen.migrate')}
      </Dialog.Action>
    </Dialog.Actions>
  </Dialog.Root>
);

export default MigrationReviewDialog;
