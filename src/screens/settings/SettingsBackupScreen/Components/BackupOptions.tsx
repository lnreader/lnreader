import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Checkbox } from '@components/Checkbox/Checkbox';
import { Dialog } from '@components/Dialog';
import { getString } from '@i18n/translations';
import {
  areAllBackupOptionsSelected,
  hasSelectedBackupOption,
  type BackupOptions,
} from '@services/backup/options';
import type { ThemeColors } from '@theme/types';

type BackupOptionKey = keyof BackupOptions;

const OPTION_KEYS: BackupOptionKey[] = [
  'library',
  'settings',
  'plugins',
  'downloadedFiles',
];

const OPTION_STRINGS: Record<
  BackupOptionKey,
  {
    description: Parameters<typeof getString>[0];
    label: Parameters<typeof getString>[0];
  }
> = {
  library: {
    label: 'backupScreen.options.library',
    description: 'backupScreen.options.libraryDescription',
  },
  settings: {
    label: 'backupScreen.options.settings',
    description: 'backupScreen.options.settingsDescription',
  },
  plugins: {
    label: 'backupScreen.options.plugins',
    description: 'backupScreen.options.pluginsDescription',
  },
  downloadedFiles: {
    label: 'backupScreen.options.downloadedFiles',
    description: 'backupScreen.options.downloadedFilesDescription',
  },
};

type BackupOptionsListProps = {
  options: BackupOptions;
  onChange: (options: BackupOptions) => void;
  theme: ThemeColors;
};

export const BackupOptionsList = ({
  options,
  onChange,
  theme,
}: BackupOptionsListProps) => {
  const allSelected = areAllBackupOptionsSelected(options);
  const someSelected = hasSelectedBackupOption(options);

  const toggleAll = useCallback(() => {
    const selected = !allSelected;
    onChange({
      library: selected,
      settings: selected,
      plugins: selected,
      downloadedFiles: selected,
    });
  }, [allSelected, onChange]);

  const toggleOption = useCallback(
    (key: BackupOptionKey) => {
      const selected = !options[key];
      onChange({
        ...options,
        [key]: selected,
        ...(key === 'library' && !selected
          ? { downloadedFiles: false }
          : undefined),
      });
    },
    [onChange, options],
  );

  return (
    <Dialog.ScrollArea>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
      >
        <Checkbox
          label={getString('backupScreen.options.selectAll')}
          onPress={toggleAll}
          status={allSelected ? true : someSelected ? 'indeterminate' : false}
          theme={theme}
        />
        <View
          style={[styles.divider, { backgroundColor: theme.outlineVariant }]}
        />
        {OPTION_KEYS.map(key => {
          const disabled = key === 'downloadedFiles' && !options.library;
          const strings = OPTION_STRINGS[key];
          return (
            <Checkbox
              key={key}
              description={getString(strings.description)}
              disabled={disabled}
              label={getString(strings.label)}
              onPress={() => toggleOption(key)}
              status={options[key]}
              theme={theme}
              viewStyle={styles.option}
            />
          );
        })}
      </ScrollView>
    </Dialog.ScrollArea>
  );
};

type BackupOptionsDialogProps = BackupOptionsListProps & {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export const BackupOptionsDialog = ({
  visible,
  options,
  onCancel,
  onChange,
  onConfirm,
  theme,
}: BackupOptionsDialogProps) => (
  <Dialog.Root
    onDismiss={onCancel}
    testID="backup-options-dialog"
    visible={visible}
  >
    <Dialog.Header>
      <Dialog.Title>{getString('backupScreen.options.title')}</Dialog.Title>
      <Dialog.Description>
        {getString('backupScreen.options.description')}
      </Dialog.Description>
    </Dialog.Header>
    <BackupOptionsList onChange={onChange} options={options} theme={theme} />
    <Dialog.Actions>
      <Dialog.Action title={getString('common.cancel')} onPress={onCancel} />
      <Dialog.Action
        disabled={!hasSelectedBackupOption(options)}
        title={getString('common.backup')}
        onPress={onConfirm}
      />
    </Dialog.Actions>
  </Dialog.Root>
);

const styles = StyleSheet.create({
  divider: {
    height: 1,
    marginVertical: 4,
  },
  option: {
    paddingVertical: 8,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
